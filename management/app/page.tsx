'use client';

import { useState } from 'react';

const catalog = [
  ['DHT11 / DHT22', 'Temperature + humidity', 'GPIO'],
  ['MQ-2 gas', 'Gas + smoke level', 'Analog / digital'],
  ['PIR motion', 'Occupancy state', 'Digital'],
  ['LDR light', 'Illuminance', 'Analog'],
  ['Soil moisture', 'Moisture percentage', 'Analog'],
  ['Smoke / flame', 'Safety state', 'Digital'],
  ['BMP280', 'Pressure + temperature', 'I²C'],
  ['Ultrasonic', 'Distance', 'GPIO'],
];

export default function ManagementHomePage() {
  const [notice, setNotice] = useState('Schema and catalog are in sync.');
  return (
    <main className="management-dashboard">
      <header className="management-header"><div><p className="eyebrow">ISYEN · OPERATIONS</p><h1>Hardware, made legible.</h1><p className="subhead">A calm control room for the shared sensor catalog, tenant homes and automation readiness.</p></div><span className="admin-badge"><i /> schema healthy</span></header>
      <div className="management-notice"><span>✦</span><p>{notice}</p><button onClick={() => setNotice('Checked just now · no firmware action was made.')}>Run check</button></div>
      <section className="ops-grid"><article className="ops-card lime"><small>HOME POLICY</small><strong>1</strong><b>home per isyen_id</b><p>Database unique index prevents duplicate homes at the source.</p></article><article className="ops-card blue"><small>DEVICE TYPES</small><strong>17</strong><b>shared catalog entries</b><p>Reference rows stay shared; tenant devices point to them.</p></article><article className="ops-card amber"><small>AUTOMATION MODEL</small><strong>3</strong><b>WHEN · IF · THEN</b><p>Trigger, condition and action JSONB remain flexible for new sensors.</p></article></section>
      <section className="management-content"><div className="catalog-panel"><div className="panel-heading"><div><span className="eyebrow">SHARED DEVICE_TYPES</span><h2>Sensor catalog coverage</h2></div><span className="catalog-count">17 ready</span></div><div className="catalog-table">{catalog.map(([type, signal, transport]) => <div className="catalog-row" key={type}><span className="type-dot" /><div><b>{type}</b><small>{signal}</small></div><span className="transport">{transport}</span><span className="ready-pill">active</span></div>)}</div></div><aside className="side-panel"><div className="panel-heading"><div><span className="eyebrow">DELIVERY BOUNDARY</span><h2>Firmware later</h2></div><span className="lock">⌁</span></div><p>ESP32 S3 N16R8 firmware is intentionally untouched in this update. Devices can be configured now; gateway upload comes after the dashboard contract is stable.</p><div className="boundary"><span>01</span><b>Database</b><small>ready</small></div><div className="boundary"><span>02</span><b>Dashboard</b><small>ready</small></div><div className="boundary muted"><span>03</span><b>ESP32 firmware</b><small>later</small></div></aside></section>
      <section className="model-strip"><div><span className="eyebrow">AUTOMATION CONTRACT</span><h2>Any sensor can become a useful action.</h2></div><div className="flow"><span>WHEN</span><i>→</i><span>IF</span><i>→</i><span>THEN</span></div></section>
    </main>
  );
}
