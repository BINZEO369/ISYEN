'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '../../lib/supabase-browser';

type SensorType = {
  key: string;
  name: string;
  category: 'sensor' | 'actuator';
  metric: string;
  unit: string;
};

type Device = {
  id: string;
  name: string;
  typeKey: string;
  room: string;
  status: 'online' | 'offline';
  value: string;
  unit: string;
  updated: string;
};

const sensorTypes: SensorType[] = [
  { key: 'sensor_dht22', name: 'DHT22 temperature & humidity', category: 'sensor', metric: 'Temperature', unit: '°C' },
  { key: 'sensor_dht11', name: 'DHT11 temperature & humidity', category: 'sensor', metric: 'Temperature', unit: '°C' },
  { key: 'sensor_mq2_gas', name: 'MQ-2 gas / smoke', category: 'sensor', metric: 'Gas level', unit: 'ppm' },
  { key: 'sensor_pir_motion', name: 'PIR motion', category: 'sensor', metric: 'Motion', unit: 'state' },
  { key: 'sensor_ldr_light', name: 'LDR light', category: 'sensor', metric: 'Light level', unit: 'lux' },
  { key: 'sensor_soil_moisture', name: 'Soil moisture', category: 'sensor', metric: 'Moisture', unit: '%' },
  { key: 'sensor_smoke', name: 'Smoke detector', category: 'sensor', metric: 'Smoke', unit: 'state' },
  { key: 'sensor_flame', name: 'Flame sensor', category: 'sensor', metric: 'Flame', unit: 'state' },
  { key: 'sensor_bmp280', name: 'BMP280 pressure', category: 'sensor', metric: 'Pressure', unit: 'hPa' },
  { key: 'sensor_ultrasonic', name: 'Ultrasonic distance', category: 'sensor', metric: 'Distance', unit: 'cm' },
  { key: 'actuator_relay', name: 'Relay / switch output', category: 'actuator', metric: 'Power', unit: 'state' },
  { key: 'actuator_smart_light', name: 'Smart light', category: 'actuator', metric: 'Brightness', unit: '%' },
];

const initialDevices: Device[] = [
  { id: 'dht22-living', name: 'Living room climate', typeKey: 'sensor_dht22', room: 'Living room', status: 'online', value: '26.4', unit: '°C', updated: '12 sec ago' },
  { id: 'pir-entry', name: 'Entry motion', typeKey: 'sensor_pir_motion', room: 'Entry', status: 'online', value: 'Clear', unit: '', updated: '8 sec ago' },
  { id: 'mq2-kitchen', name: 'Kitchen gas watch', typeKey: 'sensor_mq2_gas', room: 'Kitchen', status: 'online', value: '84', unit: 'ppm', updated: '22 sec ago' },
];

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function HomePage() {
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [homeId, setHomeId] = useState('');
  const [liveToken, setLiveToken] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'automation'>('overview');
  const [showAdd, setShowAdd] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [notice, setNotice] = useState('Live dashboard preview ready.');
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState('sensor_dht22');
  const [room, setRoom] = useState('Living room');
  const [automationName, setAutomationName] = useState('');
  const [triggerDevice, setTriggerDevice] = useState(initialDevices[0].id);
  const [operator, setOperator] = useState('greater_than');
  const [threshold, setThreshold] = useState('30');
  const [actionDevice, setActionDevice] = useState('');

  const onlineCount = devices.filter((device) => device.status === 'online').length;
  const sensors = devices.filter((device) => device.typeKey.startsWith('sensor_'));
  const selectedTrigger = devices.find((device) => device.id === triggerDevice);
  const selectedType = sensorTypes.find((type) => type.key === deviceType);
  const homeLocked = true;

  useEffect(() => {
    let cancelled = false;
    void getSupabaseBrowserClient().auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token || cancelled) return;
      setLiveToken(token);
      const response = await fetch(`${apiBase || ''}/api/v1/homes?limit=1`, { headers: { authorization: `Bearer ${token}` } }).catch(() => null);
      if (!response?.ok || cancelled) return;
      const body = await response.json() as { data?: Array<{ id: string }> };
      const firstHome = body.data?.[0]?.id;
      if (firstHome) { setHomeId(firstHome); setNotice('Live Supabase session connected.'); }
    });
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => [
    { label: 'Home', value: homeLocked ? '1 / 1' : '0 / 1', detail: 'account limit', tone: 'lime' },
    { label: 'Online devices', value: `${onlineCount}/${devices.length}`, detail: 'signal healthy', tone: 'blue' },
    { label: 'Sensors', value: `${sensors.length}`, detail: 'telemetry streams', tone: 'amber' },
    { label: 'Automations', value: '0', detail: 'ready to create', tone: 'violet' },
  ], [devices.length, homeLocked, onlineCount, sensors.length]);

  async function saveToApi(resource: string, payload: Record<string, unknown>): Promise<boolean> {
    const token = liveToken || (typeof window !== 'undefined' ? window.localStorage.getItem('isyen_access_token') : null);
    if (!apiBase || !token) return false;
    const response = await fetch(`${apiBase}/api/v1/${resource}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return response.ok;
  }

  async function handleAddDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deviceName.trim() || !selectedType) return;
    const newDevice: Device = {
      id: `local-${Date.now()}`,
      name: deviceName.trim(),
      typeKey: selectedType.key,
      room,
      status: 'offline',
      value: 'Waiting',
      unit: selectedType.unit,
      updated: 'not connected',
    };
    const saved = await saveToApi('devices', {
      home_id: homeId || 'current-home', name: newDevice.name, room_id: null, status: 'provisioning',
      config: { device_type_key: selectedType.key, room_name: room }, metadata: { dashboard_created: true },
    });
    setDevices((current) => [...current, newDevice]);
    setDeviceName('');
    setShowAdd(false);
    setNotice(saved ? `${newDevice.name} database-এ যুক্ত হয়েছে।` : `${newDevice.name} preview-তে যুক্ত হয়েছে; login/API token দিলে database-এ save হবে।`);
  }

  async function handleCreateAutomation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!automationName.trim() || !selectedTrigger) return;
    const triggerType = sensorTypes.find((type) => type.key === selectedTrigger.typeKey);
    const payload = {
      home_id: homeId || 'current-home', name: automationName.trim(), is_enabled: true,
      trigger_config: { type: 'sensor', device_id: selectedTrigger.id, metric: triggerType?.metric.toLowerCase(), operator, value: Number(threshold) || threshold },
      condition_config: {}, action_config: { device_id: actionDevice || null, command: { power: true } },
    };
    const saved = await saveToApi('automations', payload);
    setShowAutomation(false);
    setAutomationName('');
    setNotice(saved ? 'Automation database-এ সক্রিয় হয়েছে।' : 'Automation preview-তে তৈরি হয়েছে; live save-এর জন্য login/API token দরকার।');
  }

  return (
    <main id="sensor-route" className="dashboard-shell">
      <aside className="side-rail">
        <div className="brand-lockup"><span className="brand-mark">ই</span><span><strong>ISYEN</strong><small>SMART HOME</small></span></div>
        <div className="home-switcher"><span className="live-dot" /> <span><b>My home</b><small>One home per account</small></span><span className="chevron">⌄</span></div>
        <nav className="nav-stack" aria-label="Dashboard navigation">
          <button className={activeTab === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab('overview')}>⌂ <span>Overview</span></button>
          <button className={activeTab === 'devices' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab('devices')}>◌ <span>Sensors & devices</span><em>{devices.length}</em></button>
          <button className={activeTab === 'automation' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab('automation')}>↗ <span>Automations</span></button>
        </nav>
        <div className="rail-footer"><span className="signal-bars">▂▅▇</span><div><b>Gateway offline</b><small>Connect ESP32 later</small></div></div>
      </aside>

      <section className="main-canvas">
        <header className="topbar"><div><p className="eyebrow">WEDNESDAY · 12 NOV 2026</p><h1>Good evening, <span>home.</span></h1></div><div className="top-actions"><span className="connection-pill"><i /> Preview mode</span><button className="avatar">IS</button></div></header>
        <div className="notice"><span>✦</span><p>{notice}</p><button onClick={() => setNotice('Dashboard state refreshed just now.')}>Refresh</button></div>

        <div className="summary-grid">{summary.map((item) => <article className={`summary-card ${item.tone}`} key={item.label}><p>{item.label}</p><strong>{item.value}</strong><small>{item.detail}</small></article>)}</div>

        {activeTab === 'overview' && <>
          <section className="hero-panel"><div><span className="section-kicker">HOME PULSE</span><h2>Everything feels <i>quiet.</i></h2><p>Your home has a calm signal. Add sensors to give it more awareness, then turn signals into simple automations.</p><div className="hero-actions"><button className="primary-button" onClick={() => { setActiveTab('devices'); setShowAdd(true); }}>+ Add a sensor</button><button className="ghost-button" onClick={() => { setActiveTab('automation'); setShowAutomation(true); }}>Build automation ↗</button></div></div><div className="pulse-orbit"><span className="orbit-ring ring-one" /><span className="orbit-ring ring-two" /><span className="pulse-core">{onlineCount}<small>live</small></span></div></section>
          <section className="section-block"><div className="section-heading"><div><span className="section-kicker">LIVE SIGNALS</span><h2>Sensor snapshot</h2></div><button className="text-button" onClick={() => setActiveTab('devices')}>View all →</button></div><div className="device-grid">{devices.slice(0, 3).map((device) => <DeviceCard device={device} key={device.id} />)}</div></section>
          <section className="lower-grid"><article className="info-card home-limit"><div className="card-icon">⌂</div><span className="section-kicker">ACCOUNT GUARDRAIL</span><h3>One home, one clear control plane.</h3><p>This account is linked to <b>My home</b>. Rooms, sensors, devices and automations stay safely inside this home.</p><div className="limit-meter"><span /><b>1 home</b><small>maximum</small></div></article><article className="info-card automation-preview"><div className="section-heading compact"><div><span className="section-kicker">NEXT STEP</span><h3>Make the home react.</h3></div><span className="spark">✦</span></div><p>Turn a temperature, gas or motion signal into a light, notification, or safety action.</p><button className="dark-button" onClick={() => { setActiveTab('automation'); setShowAutomation(true); }}>Create first automation</button></article></section>
        </>}

        {activeTab === 'devices' && <DevicesView devices={devices} onAdd={() => setShowAdd(true)} />}
        {activeTab === 'automation' && <AutomationView devices={devices} onCreate={() => setShowAutomation(true)} />}
      </section>

      {showAdd && <Modal title="Add a sensor or device" onClose={() => setShowAdd(false)}><form onSubmit={handleAddDevice} className="form-stack"><label>Device name<input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="e.g. Bedroom climate" autoFocus required /></label><label>Shared device type<select value={deviceType} onChange={(event) => setDeviceType(event.target.value)}>{sensorTypes.map((type) => <option value={type.key} key={type.key}>{type.name}</option>)}</select></label><label>Room<input value={room} onChange={(event) => setRoom(event.target.value)} placeholder="e.g. Bedroom" /></label><div className="form-note">The catalog is shared. Your account gets its own device record and sensor stream.</div><button className="primary-button" type="submit">Add to My home</button></form></Modal>}
      {showAutomation && <Modal title="Build an automation" onClose={() => setShowAutomation(false)}><form onSubmit={handleCreateAutomation} className="form-stack"><label>Automation name<input value={automationName} onChange={(event) => setAutomationName(event.target.value)} placeholder="e.g. Cool the room" autoFocus required /></label><div className="flow-label">WHEN</div><label>Sensor trigger<select value={triggerDevice} onChange={(event) => setTriggerDevice(event.target.value)}>{sensors.map((device) => <option value={device.id} key={device.id}>{device.name} · {device.value} {device.unit}</option>)}</select></label><div className="split-fields"><label>Condition<select value={operator} onChange={(event) => setOperator(event.target.value)}><option value="greater_than">is greater than</option><option value="less_than">is less than</option><option value="equals">equals</option></select></label><label>Value<input value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label></div><div className="flow-label">THEN</div><label>Action device<select value={actionDevice} onChange={(event) => setActionDevice(event.target.value)}><option value="">Create a notification</option>{devices.filter((device) => device.typeKey.startsWith('actuator_')).map((device) => <option value={device.id} key={device.id}>{device.name}</option>)}</select></label><div className="form-note">Saved as trigger_config, condition_config and action_config so every sensor can have its own rule.</div><button className="primary-button" type="submit">Save automation</button></form></Modal>}
    </main>
  );
}

function DeviceCard({ device }: { device: Device }) {
  const type = sensorTypes.find((item) => item.key === device.typeKey);
  return <article className="device-card"><div className="device-card-top"><span className={`device-glyph ${device.typeKey.includes('pir') ? 'pink' : device.typeKey.includes('gas') ? 'amber' : 'blue'}`}>{device.typeKey.includes('pir') ? '◉' : device.typeKey.includes('gas') ? '⌁' : '◌'}</span><span className="status-chip"><i />{device.status}</span></div><p className="device-kind">{type?.name}</p><h3>{device.name}</h3><div className="reading"><strong>{device.value}</strong><span>{device.unit}</span></div><footer><span>{device.room}</span><span>{device.updated}</span></footer></article>;
}

function DevicesView({ devices, onAdd }: { devices: Device[]; onAdd: () => void }) {
  return <section className="section-block page-view"><div className="section-heading"><div><span className="section-kicker">DEVICE MANAGEMENT</span><h2>Sensors & devices</h2><p className="heading-copy">Choose from the shared catalog. Each device belongs only to this home.</p></div><button className="primary-button" onClick={onAdd}>+ Add device</button></div><div className="device-grid">{devices.map((device) => <DeviceCard device={device} key={device.id} />)}</div><div className="catalog-note"><span>⌘</span><div><b>Sensor catalog ready</b><p>DHT, GAS, PIR, light, soil, smoke, flame, pressure and distance types are available. New hardware can be added as another shared device type without changing tenant tables.</p></div></div></section>;
}

function AutomationView({ devices, onCreate }: { devices: Device[]; onCreate: () => void }) {
  const sensors = devices.filter((device) => device.typeKey.startsWith('sensor_'));
  return <section className="section-block page-view"><div className="section-heading"><div><span className="section-kicker">AUTOMATION MANAGEMENT</span><h2>Rules that feel natural.</h2><p className="heading-copy">Every rule follows a clear WHEN → IF → THEN shape.</p></div><button className="primary-button" onClick={onCreate}>+ New automation</button></div><div className="automation-empty"><div className="empty-orbit">↗</div><h3>No automation yet</h3><p>{sensors.length} sensor signal{sensors.length === 1 ? '' : 's'} are ready to become useful actions.</p><button className="dark-button" onClick={onCreate}>Build first rule</button></div></section>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="section-kicker">ISYEN BUILDER</span><h2 id="modal-title">{title}</h2></div><button className="close-button" onClick={onClose} aria-label="Close">×</button></div>{children}</section></div>;
}
