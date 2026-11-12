"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppShell } from "./app-shell";
import { ApiRequestError, createGpioLight, createGpioSensor, createProtocolSensor, createHome, ESP32_S3_ANALOG_INPUT_GPIO_PINS, ESP32_S3_DIGITAL_INPUT_GPIO_PINS, ESP32_S3_OUTPUT_GPIO_PINS, loadDeviceIdentity, loadLatestSensorReadings, loadProfile, loadResource, updateDevice, type Automation, type Device, type DeviceState, type Gateway, type Home, type Profile, type ProtocolSensorKey, type Room, type Scene, type SensorReading } from "../lib/app-data";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type DashboardData = {
  profile: Profile;
  isyenId: string;
  homes: Home[];
  devices: Device[];
  deviceStates: DeviceState[];
  rooms: Room[];
  gateways: Gateway[];
  scenes: Scene[];
  automations: Automation[];
};

type DraftHome = { name: string; address_line_1: string; city: string; country: string };
const emptyDraft: DraftHome = { name: "", address_line_1: "", city: "", country: "" };
type DraftLight = { name: string; room_id: string; gpio: number };
type DraftSensor = { name: string; room_id: string; sensor_key: ProtocolSensorKey | "gpio" | ""; input_mode: "" | "analog" | "digital"; gpio: string; sda_gpio: string; scl_gpio: string; i2c_address: "0x76" | "0x77"; metric: string; unit: string; sample_interval_ms: string; sampling_interval_seconds: string; temperature_unit: "celsius" | "fahrenheit"; pull_mode: "none" | "up" | "down" };
const emptySensorDraft: DraftSensor = { name: "", room_id: "", sensor_key: "", input_mode: "", gpio: "", sda_gpio: "8", scl_gpio: "9", i2c_address: "0x76", metric: "", unit: "", sample_interval_ms: "5000", sampling_interval_seconds: "30", temperature_unit: "celsius", pull_mode: "none" };

export function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedHomeId, setSelectedHomeId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<DraftHome>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [lightCreateOpen, setLightCreateOpen] = useState(false);
  const [lightDraft, setLightDraft] = useState<DraftLight>({ name: "লাইট", room_id: "", gpio: 4 });
  const [creatingLight, setCreatingLight] = useState(false);
  const [lightCreateError, setLightCreateError] = useState("");
  const [sensorDraft, setSensorDraft] = useState<DraftSensor>(emptySensorDraft);
  const [sensorCreateOpen, setSensorCreateOpen] = useState(false);
  const [creatingSensor, setCreatingSensor] = useState(false);
  const [sensorCreateError, setSensorCreateError] = useState("");
  const [sensorReadings, setSensorReadings] = useState<SensorReading[]>([]);
  const [sensorLive, setSensorLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: authData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !authData.session) {
          router.replace("/sign-in");
          return;
        }
        const token = authData.session.access_token;
        const profilePromise = loadProfile(token);
        const identityPromise = loadDeviceIdentity(token);
        const resourcesPromise = Promise.all([
          loadResource<Home>("homes", token),
          loadResource<Device>("devices", token),
          loadResource<DeviceState>("device_states", token),
          loadResource<Room>("rooms", token),
          loadResource<Gateway>("gateways", token),
          loadResource<Scene>("scenes", token),
          loadResource<Automation>("automations", token),
        ]);
        const [profile, identity, [homes, devices, deviceStates, rooms, gateways, scenes, automations]] = await Promise.all([profilePromise, identityPromise, resourcesPromise]);
        if (!cancelled) {
          setAccessToken(token);
          setData({ profile, isyenId: identity.isyen_id, homes, devices, deviceStates, rooms, gateways, scenes, automations });
          setSelectedHomeId((current) => current || homes[0]?.id || "");
        }
      } catch (caught) {
        if (caught instanceof ApiRequestError && caught.status === 401) {
          await getSupabaseBrowserClient().auth.signOut();
          router.replace("/sign-in");
          return;
        }
        if (!cancelled) setError(caught instanceof Error ? caught.message : "ড্যাশবোর্ডের তথ্য লোড করা যায়নি।");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [router, retryCount]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const session = await getSupabaseBrowserClient().auth.getSession();
        const token = session.data.session?.access_token || accessToken;
        const [devices, deviceStates] = await Promise.all([
          loadResource<Device>("devices", token),
          loadResource<DeviceState>("device_states", token),
        ]);
        if (!cancelled) {
          setAccessToken(token);
          setData((current) => current ? { ...current, devices, deviceStates } : current);
        }
      } catch {
        // The initial page error is shown on first load; transient polling failures keep the last known state.
      }
    };
    const timer = window.setInterval(() => void refresh(), 6_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !selectedHomeId) {
      setSensorReadings([]);
      setSensorLive(false);
      return;
    }
    let cancelled = false;
    let reloadTimer: number | undefined;
    const supabase = getSupabaseBrowserClient();
    const refreshReadings = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token || accessToken;
        const readings = await loadLatestSensorReadings(selectedHomeId, token);
        if (!cancelled) {
          setAccessToken(token);
          setSensorReadings(readings);
        }
      } catch {
        // Keep the last successful values during transient network/API failures.
      }
    };
    const scheduleRefresh = () => {
      if (reloadTimer !== undefined) window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => void refreshReadings(), 350);
    };
    setSensorReadings([]);
    setSensorLive(false);
    void refreshReadings();
    const channel = supabase.channel(`sensor-data-${selectedHomeId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "sensor_data_default",
        filter: `home_id=eq.${selectedHomeId}`,
      }, scheduleRefresh)
      .subscribe((status) => {
        if (cancelled) return;
        setSensorLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") scheduleRefresh();
      });
    const fallback = window.setInterval(() => void refreshReadings(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(fallback);
      if (reloadTimer !== undefined) window.clearTimeout(reloadTimer);
      void supabase.removeChannel(channel);
    };
  }, [accessToken, selectedHomeId]);

  const selectedHome = data?.homes.find((home) => home.id === selectedHomeId) ?? data?.homes[0] ?? null;
  const homeDevices = useMemo(() => data?.devices.filter((item) => item.home_id === selectedHome?.id) ?? [], [data?.devices, selectedHome?.id]);
  const homeRooms = useMemo(() => data?.rooms.filter((item) => item.home_id === selectedHome?.id) ?? [], [data?.rooms, selectedHome?.id]);
  const usedGpioPins = new Set((data?.devices ?? []).filter(isEsp32S3GpioDevice).map((device) => device.config?.gpio).filter((pin): pin is number => typeof pin === "number"));
  const availableGpioPins = ESP32_S3_OUTPUT_GPIO_PINS.filter((pin) => !usedGpioPins.has(pin));
  const hasAvailableSensorPin = [...ESP32_S3_DIGITAL_INPUT_GPIO_PINS, ...ESP32_S3_ANALOG_INPUT_GPIO_PINS].some((pin) => !usedGpioPins.has(pin));
  const sensorPinList = sensorDraft.input_mode === "analog" ? ESP32_S3_ANALOG_INPUT_GPIO_PINS : ESP32_S3_DIGITAL_INPUT_GPIO_PINS;
  const availableSensorPins = sensorPinList.filter((pin) => !usedGpioPins.has(pin));
  const homeGateways = useMemo(() => data?.gateways.filter((item) => item.home_id === selectedHome?.id) ?? [], [data?.gateways, selectedHome?.id]);
  const homeScenes = useMemo(() => data?.scenes.filter((item) => item.home_id === selectedHome?.id) ?? [], [data?.scenes, selectedHome?.id]);
  const homeAutomations = useMemo(() => data?.automations.filter((item) => item.home_id === selectedHome?.id) ?? [], [data?.automations, selectedHome?.id]);
  const homeSensors = useMemo(() => homeDevices.filter(isSensorDevice), [homeDevices]);
  const homeReadings = useMemo(() => sensorReadings.filter((reading) => reading.home_id === selectedHome?.id), [sensorReadings, selectedHome?.id]);

  async function handleCreateHome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !data) return;
    setCreating(true);
    setCreateError("");
    try {
      const address = Object.fromEntries(Object.entries({
        address_line_1: draft.address_line_1.trim(), city: draft.city.trim(), country: draft.country.trim(),
      }).filter(([, value]) => value));
      const home = await createHome({ name: draft.name.trim(), timezone: data.profile.timezone || "Asia/Dhaka", address }, accessToken);
      setData((current) => current ? { ...current, homes: [home, ...current.homes] } : current);
      setSelectedHomeId(home.id);
      setDraft(emptyDraft);
      setCreateOpen(false);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 401) {
        await getSupabaseBrowserClient().auth.signOut();
        router.replace("/sign-in");
        return;
      }
      setCreateError(caught instanceof Error ? caught.message : "Home তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateLight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !selectedHome) return;
    setCreatingLight(true);
    setLightCreateError("");
    try {
      const device = await createGpioLight({
        home_id: selectedHome.id,
        room_id: lightDraft.room_id || null,
        name: lightDraft.name.trim(),
        gpio: lightDraft.gpio,
      }, accessToken);
      setData((current) => current ? { ...current, devices: [device, ...current.devices] } : current);
      setLightCreateOpen(false);
      setLightDraft({ name: "লাইট", room_id: "", gpio: 4 });
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 401) {
        await getSupabaseBrowserClient().auth.signOut();
        router.replace("/sign-in");
        return;
      }
      setLightCreateError(caught instanceof Error ? caught.message : "লাইট যোগ করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setCreatingLight(false);
    }
  }

  async function handleCreateSensor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !selectedHome) return;
    setCreatingSensor(true);
    setSensorCreateError("");
    try {
      const device = sensorDraft.sensor_key && sensorDraft.sensor_key !== "gpio"
        ? await createProtocolSensor({
          home_id: selectedHome.id, room_id: sensorDraft.room_id || null, name: sensorDraft.name.trim(),
          sensor_key: sensorDraft.sensor_key,
          ...(sensorDraft.sensor_key.startsWith("dht") ? { data_gpio: Number(sensorDraft.gpio) } : { sda_gpio: Number(sensorDraft.sda_gpio), scl_gpio: Number(sensorDraft.scl_gpio), i2c_address: sensorDraft.i2c_address }),
          sampling_interval_seconds: Number(sensorDraft.sampling_interval_seconds), temperature_unit: sensorDraft.temperature_unit,
        }, accessToken)
        : await createGpioSensor({
        home_id: selectedHome.id,
        room_id: sensorDraft.room_id || null,
        name: sensorDraft.name.trim(),
        gpio: Number(sensorDraft.gpio),
        input_mode: sensorDraft.input_mode as "analog" | "digital",
        metric: sensorDraft.metric.trim().toLowerCase(),
        unit: sensorDraft.unit.trim(),
        sample_interval_ms: Number(sensorDraft.sample_interval_ms),
        pull_mode: sensorDraft.input_mode === "digital" ? sensorDraft.pull_mode : "none",
      }, accessToken);
      setData((current) => current ? { ...current, devices: [device, ...current.devices] } : current);
      setSensorDraft(emptySensorDraft);
      setSensorCreateOpen(false);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 401) {
        await getSupabaseBrowserClient().auth.signOut();
        router.replace("/sign-in");
        return;
      }
      setSensorCreateError(caught instanceof Error ? caught.message : "সেন্সর তৈরি করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setCreatingSensor(false);
    }
  }

  async function handleUpdateDevice(deviceId: string, config: Record<string, unknown>): Promise<Device> {
    if (!accessToken) throw new Error("আপনার সাইন-ইন সেশন নেই। আবার সাইন ইন করুন।");
    const updated = await updateDevice(deviceId, { config }, accessToken);
    setData((current) => current ? { ...current, devices: current.devices.map((device) => device.id === updated.id ? updated : device) } : current);
    return updated;
  }

  if (loading) return <main className="dashboard-loading"><span className="button-spinner" /><p>আপনার স্মার্ট হোম লোড হচ্ছে…</p></main>;
  if (!data) return <main className="dashboard-loading"><div className="dashboard-error"><span className="error-mark">!</span><h1>ড্যাশবোর্ড লোড হয়নি</h1><p>{error || "আপনার অ্যাপের তথ্য আনা যায়নি।"}</p><button className="primary-button" onClick={() => { setError(""); setLoading(true); setRetryCount((count) => count + 1); }}>আবার চেষ্টা করুন</button><button className="text-button" onClick={() => void getSupabaseBrowserClient().auth.signOut().then(() => router.replace("/sign-in"))}>সাইন আউট</button></div></main>;

  const profile = data.profile;
  const displayName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email;
  const activeDevices = homeDevices.filter((device) => device.status === "online").length;
  const enabledScenes = homeScenes.filter((scene) => scene.is_enabled).length;
  const enabledAutomations = homeAutomations.filter((automation) => automation.is_enabled).length;
  const gatewayOnline = homeGateways.filter((gateway) => gateway.status === "online").length;
  const controlDevices = homeDevices.filter((device) => !isEsp32S3Sensor(device));

  return (
    <AppShell profile={profile} active="dashboard" eyebrow="SMART HOME CONTROL" title={`স্বাগতম, ${displayName.split(" ")[0]}`} description="আপনার বাড়ি, ডিভাইস ও দৈনন্দিন অটোমেশন—এক নজরে, এক নিয়ন্ত্রণে।">
      <section className="home-toolbar">
        <div className="selected-home-label"><span className="home-label-icon" aria-hidden="true">⌂</span><div><small>নির্বাচিত HOME</small><strong>{selectedHome?.name ?? "এখনও Home যোগ করা হয়নি"}</strong></div></div>
        <div className="home-toolbar-actions">
          {data.homes.length > 0 && <label className="home-select-wrap"><span className="visually-hidden">Home নির্বাচন করুন</span><select value={selectedHome?.id ?? ""} onChange={(event) => setSelectedHomeId(event.target.value)} aria-label="Home নির্বাচন করুন">{data.homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select><span aria-hidden="true">⌄</span></label>}
          <Link className="outline-action" href="#sensors">◌ <span>সেন্সর কনফিগারেশন</span></Link>
          <button className="outline-action" type="button" onClick={() => { setLightCreateError(""); setLightDraft((current) => ({ ...current, gpio: availableGpioPins[0] ?? 4 })); setLightCreateOpen(true); }} disabled={!selectedHome || availableGpioPins.length === 0}>＋ <span>লাইট যোগ করুন</span></button>
          <button className="outline-action" type="button" onClick={() => { setSensorCreateError(""); setSensorDraft(emptySensorDraft); setSensorCreateOpen(true); }} disabled={!selectedHome}>＋ <span>সেন্সর যোগ করুন</span></button>
          <button className="outline-action" type="button" onClick={() => { setCreateError(""); setCreateOpen(true); }}>＋ <span>Home যোগ করুন</span></button>
        </div>
      </section>

      <section className="smart-stats-grid" aria-label="স্মার্ট হোমের সারাংশ">
        <StatCard icon="◉" label="মোট ডিভাইস" value={homeDevices.length} foot={homeDevices.length ? `${activeDevices}টি অনলাইন` : "এখনও ডিভাইস নেই"} tone="sage" />
        <StatCard icon="⌂" label="রুম" value={homeRooms.length} foot={homeRooms.length ? "আপনার Home-এ" : "রুম যোগ করুন"} tone="sand" />
        <StatCard icon="✳" label="সিন" value={homeScenes.length} foot={homeScenes.length ? `${enabledScenes}টি সক্রিয়` : "দ্রুত নিয়ন্ত্রণের জন্য"} tone="lilac" />
        <StatCard icon="⟳" label="অটোমেশন" value={homeAutomations.length} foot={homeAutomations.length ? `${enabledAutomations}টি চালু` : "রুটিন তৈরি করুন"} tone="blue" />
      </section>

      {!selectedHome ? (
        <section className="home-setup-panel" id="home-setup">
          <div className="setup-art" aria-hidden="true"><div className="setup-sun" /><div className="setup-house"><span /><i /><b /></div><div className="setup-ground" /></div>
          <div className="setup-copy"><span className="setup-kicker">আপনার ISYEN যাত্রা শুরু হোক</span><h2>আপনার স্মার্ট হোম তৈরি করুন</h2><p>প্রথম Home যোগ করার পর এখানে রুম, ডিভাইস, গেটওয়ে এবং অটোমেশনের লাইভ অবস্থা দেখতে পাবেন।</p><button className="primary-button" type="button" onClick={() => { setCreateError(""); setCreateOpen(true); }}>প্রথম Home তৈরি করুন <span aria-hidden="true">→</span></button></div>
        </section>
      ) : (
        <>
          <section className="home-overview-card">
            <div className="home-overview-copy"><span className="overview-kicker"><i /> {selectedHome.status === "active" ? "HOME ACTIVE" : selectedHome.status.toUpperCase()}</span><h2>{selectedHome.name}</h2><p>{homeAddress(selectedHome) || "আপনার বাড়ির ঠিকানা এখনো যোগ করা হয়নি।"}</p><span className="timezone-pill">◷ {selectedHome.timezone || profile.timezone}</span></div>
            <div className="overview-illustration" aria-hidden="true"><div className="overview-glow" /><div className="overview-window"><i /><i /><i /><i /></div><div className="overview-roof" /><div className="overview-house"><span /><b /><i /></div><div className="overview-plant plant-one"><i /><i /><b /></div><div className="overview-plant plant-two"><i /><i /><b /></div></div>
            <div className="home-live-summary"><span className="live-summary-icon">⌂</span><strong>{homeDevices.length}</strong><small>সংযুক্ত ডিভাইস</small><span className={`gateway-state${gatewayOnline ? " gateway-online" : ""}`}><i /> {gatewayOnline ? `${gatewayOnline} gateway online` : homeGateways.length ? "Gateway offline" : "Gateway যোগ হয়নি"}</span></div>
          </section>

          <section className="dashboard-panel sensor-panel" id="sensors">
            <div className="dashboard-panel-heading"><div><span className="panel-eyebrow">REAL-TIME SENSOR DATA</span><h2>সেন্সর ও লাইভ ডেটা</h2></div><div className="sensor-heading-actions"><span className={`sensor-live-pill${sensorLive ? " sensor-live-on" : ""}`}><i />{sensorLive ? "লাইভ" : "সংযোগ হচ্ছে"}</span><span className="panel-count">{homeSensors.length} সেন্সর</span></div></div>
            {homeSensors.length ? <div className="sensor-grid">{homeSensors.map((device) => isProtocolSensor(device) ? <ProtocolSensorCard key={device.id} device={device} /> : <GpioSensorCard key={device.id} device={device} usedPins={Array.from(usedGpioPins).filter((pin) => pin !== device.config.gpio)} reading={homeReadings.find((reading) => reading.device_id === device.id)} onUpdate={(config) => handleUpdateDevice(device.id, config)} />)}</div> : <div className="sensor-empty-state"><div><span className="sensor-empty-icon" aria-hidden="true">◉</span><strong>এই Home-এ এখনো কোনো sensor configured নেই</strong><p>Pin, sensor mode, metric ও sampling interval নির্ধারণ করুন। আসল value firmware রিপোর্ট করলেই এখানে live দেখা যাবে—ডেমো বা default readings দেখানো হবে না।</p></div><button className="primary-button" type="button" onClick={() => { setSensorCreateError(""); setSensorDraft(emptySensorDraft); setSensorCreateOpen(true); }} disabled={!hasAvailableSensorPin}>＋ সেন্সর কনফিগার করুন</button></div>}
          </section>

          <section className="dashboard-panel" id="devices">
            <div className="dashboard-panel-heading"><div><span className="panel-eyebrow">CONTROL YOUR HOME</span><h2>ডিভাইস ও রুম</h2></div><span className="panel-count">{controlDevices.length} ডিভাইস · {homeRooms.length} রুম</span></div>
            {controlDevices.length ? <div className="device-grid">{controlDevices.map((device) => isEsp32S3Light(device) ? <GpioLightCard key={device.id} device={device} isyenId={data.isyenId} usedPins={Array.from(usedGpioPins).filter((pin) => pin !== device.config.gpio)} report={data.deviceStates.find((state) => state.device_id === device.id)} onUpdate={(config) => handleUpdateDevice(device.id, config)} /> : <article className="device-card" key={device.id}><span className="device-icon" aria-hidden="true">{deviceGlyph(device.name)}</span><span className={`device-status${device.status === "online" ? " device-status-online" : ""}`}><i />{device.status === "online" ? "অনলাইন" : device.status === "offline" ? "অফলাইন" : device.status}</span><h3>{device.name}</h3><p>{homeRooms.find((room) => room.id === device.room_id)?.name ?? "রুম নির্ধারিত নয়"}</p><span className="device-card-footer">{device.status === "online" ? "সংযুক্ত" : "সংযোগের অপেক্ষায়"}<span>›</span></span></article>)}</div> : <EmptyPanel icon="◉" title="এখনও কোনো light বা control device নেই" description="একটি light যোগ করলে ESP32 account-এর configured light-গুলো খুঁজে নিয়ন্ত্রণ করবে। Sensor-গুলো উপরের লাইভ সেন্সর অংশে দেখানো হয়।" />}
            {homeRooms.length > 0 && <div className="room-strip"><span className="room-strip-title">আপনার রুম</span>{homeRooms.slice(0, 5).map((room) => <span className="room-chip" key={room.id}><i />{room.name}</span>)}</div>}
          </section>

          <div className="dashboard-lower-grid">
            <section className="dashboard-panel" id="scenes">
              <div className="dashboard-panel-heading"><div><span className="panel-eyebrow">ONE-TAP MOMENTS</span><h2>আপনার সিন</h2></div><span className="panel-count">{homeScenes.length}</span></div>
              {homeScenes.length ? <div className="scene-list">{homeScenes.slice(0, 4).map((scene) => <div className="scene-row" key={scene.id}><span className="scene-mark">{scene.icon || "✳"}</span><span className="scene-copy"><strong>{scene.name}</strong><small>{scene.description || "আপনার তৈরি স্মার্ট দৃশ্য"}</small></span><span className={`scene-state${scene.is_enabled ? " scene-state-on" : ""}`}>{scene.is_enabled ? "প্রস্তুত" : "বন্ধ"}</span></div>)}</div> : <EmptyPanel icon="✳" title="সিন দিয়ে শুরু করুন" description="একটি ট্যাপে আপনার পছন্দের ডিভাইস অবস্থা সাজিয়ে রাখুন।" compact />}
            </section>
            <section className="dashboard-panel" id="automations">
              <div className="dashboard-panel-heading"><div><span className="panel-eyebrow">SMART ROUTINES</span><h2>অটোমেশন</h2></div><span className="panel-count">{enabledAutomations} চালু</span></div>
              {homeAutomations.length ? <div className="automation-list">{homeAutomations.slice(0, 4).map((automation) => <div className="automation-row" key={automation.id}><span className="automation-icon">⟳</span><span className="scene-copy"><strong>{automation.name}</strong><small>{automation.description || "আপনার স্মার্ট রুটিন"}</small></span><span className={`automation-toggle${automation.is_enabled ? " is-on" : ""}`} aria-label={automation.is_enabled ? "চালু" : "বন্ধ"}><i /></span></div>)}</div> : <EmptyPanel icon="⟳" title="আপনার রুটিন এখনো নেই" description="দৈনন্দিন কাজ স্বয়ংক্রিয় করতে অটোমেশন তৈরি করুন।" compact />}
            </section>
          </div>
          <section className="dashboard-next-step" id="home-setup"><span className="next-step-icon" aria-hidden="true">✦</span><div><span className="panel-eyebrow">NEXT STEP</span><h2>আপনার Home-কে আরও স্মার্ট করুন</h2><p>রুম তৈরি করুন, gateway যুক্ত করুন, তারপর ডিভাইস ও automation একসাথে সাজান।</p></div><Link href="/account" className="next-step-link">অ্যাকাউন্ট দেখুন <span aria-hidden="true">→</span></Link></section>
        </>
      )}
      <div className="dashboard-bottom-note"><span><i /> আপনার ডেটা ব্যক্তিগতভাবে সুরক্ষিত</span><Link href="/account">অ্যাকাউন্ট তথ্য <span aria-hidden="true">→</span></Link></div>

      {createOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) setCreateOpen(false); }}><section className="home-modal" role="dialog" aria-modal="true" aria-labelledby="home-modal-title"><button className="modal-close" type="button" aria-label="বন্ধ করুন" onClick={() => setCreateOpen(false)} disabled={creating}>×</button><span className="setup-kicker">HOME SETUP · 01</span><h2 id="home-modal-title">নতুন Home যোগ করুন</h2><p>আপনার বাড়ির নাম ও লোকেশন দিন। পরে সেটিংস থেকে পরিবর্তন করা যাবে।</p><form className="home-create-form" onSubmit={handleCreateHome}><label className="form-field"><span>Home-এর নাম <b>*</b></span><input autoFocus required maxLength={120} placeholder="যেমন: আমার বাড়ি" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label><label className="form-field"><span>ঠিকানা</span><input autoComplete="street-address" maxLength={250} placeholder="রোড / এলাকার নাম" value={draft.address_line_1} onChange={(event) => setDraft((current) => ({ ...current, address_line_1: event.target.value }))} /></label><div className="form-grid"><label className="form-field"><span>শহর</span><input autoComplete="address-level2" maxLength={120} placeholder="ঢাকা" value={draft.city} onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))} /></label><label className="form-field"><span>দেশ</span><input autoComplete="country-name" maxLength={120} placeholder="বাংলাদেশ" value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} /></label></div>{createError && <p className="form-alert" role="alert">{createError}</p>}<div className="home-modal-actions"><button className="outline-action" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>বাতিল</button><button className="primary-button" type="submit" disabled={creating}>{creating ? <><span className="button-spinner" /> তৈরি হচ্ছে…</> : <>Home তৈরি করুন <span aria-hidden="true">→</span></>}</button></div></form></section></div>}
      {lightCreateOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creatingLight) setLightCreateOpen(false); }}><section className="home-modal light-modal" role="dialog" aria-modal="true" aria-labelledby="light-modal-title"><button className="modal-close" type="button" aria-label="বন্ধ করুন" onClick={() => setLightCreateOpen(false)} disabled={creatingLight}>×</button><span className="setup-kicker">ESP32-S3 · GPIO LIGHT</span><h2 id="light-modal-title">নতুন লাইট যোগ করুন</h2><p>একটি output GPIO বেছে নিন। পরে এই pin বদলালেও অন/অফ বাটন একই থাকবে। ESP32 এই account-এর সব light নিজে খুঁজে নেবে; প্রতি light-এর ID দিতে হবে না।</p><form className="home-create-form" onSubmit={handleCreateLight}><label className="form-field"><span>লাইটের নাম <b>*</b></span><input autoFocus required maxLength={120} value={lightDraft.name} onChange={(event) => setLightDraft((current) => ({ ...current, name: event.target.value }))} /></label>{homeRooms.length > 0 && <label className="form-field"><span>রুম</span><select value={lightDraft.room_id} onChange={(event) => setLightDraft((current) => ({ ...current, room_id: event.target.value }))}><option value="">রুম নির্ধারণ করব পরে</option>{homeRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>}<label className="form-field"><span>ESP32-S3 GPIO pin <b>*</b></span><select value={lightDraft.gpio} onChange={(event) => setLightDraft((current) => ({ ...current, gpio: Number(event.target.value) }))}>{availableGpioPins.map((pin) => <option key={pin} value={pin}>GPIO {pin}</option>)}</select></label><p className="field-note">GPIO 0/3/19/20/45/46 ও মডিউলের flash/PSRAM pin নিরাপত্তার জন্য তালিকায় নেই। একই GPIO একাধিক light-এ বরাদ্দ করা যাবে না।</p>{lightCreateError && <p className="form-alert" role="alert">{lightCreateError}</p>}<div className="home-modal-actions"><button className="outline-action" type="button" onClick={() => setLightCreateOpen(false)} disabled={creatingLight}>বাতিল</button><button className="primary-button" type="submit" disabled={creatingLight || !availableGpioPins.length}>{creatingLight ? <><span className="button-spinner" /> তৈরি হচ্ছে…</> : <>লাইট তৈরি করুন <span aria-hidden="true">→</span></>}</button></div></form></section></div>}
      {sensorCreateOpen && <SensorCreateDialog draft={sensorDraft} rooms={homeRooms} pins={availableSensorPins} error={sensorCreateError} loading={creatingSensor} onChange={setSensorDraft} onClose={() => setSensorCreateOpen(false)} onSubmit={handleCreateSensor} />}
    </AppShell>
  );
}

function isEsp32S3Light(device: Device): boolean {
  return device.config?.hardware === "esp32_s3_gpio_light";
}

function isEsp32S3Sensor(device: Device): boolean {
  return device.config?.hardware === "esp32_s3_gpio_sensor" || device.config?.hardware === "isyen_protocol_sensor";
}
function isProtocolSensor(device: Device): boolean { return device.config?.hardware === "isyen_protocol_sensor"; }
function isSensorDevice(device: Device): boolean { return isEsp32S3Sensor(device); }

function isEsp32S3GpioDevice(device: Device): boolean {
  return isEsp32S3Light(device) || isEsp32S3Sensor(device);
}

function GpioLightCard({ device, isyenId, usedPins, report, onUpdate }: { device: Device; isyenId: string; usedPins: number[]; report?: DeviceState; onUpdate: (config: Record<string, unknown>) => Promise<Device> }) {
  const config = device.config ?? {};
  const configuredPin = typeof config.gpio === "number" ? config.gpio : 4;
  const [pin, setPin] = useState(configuredPin);
  const [busy, setBusy] = useState(false);
  const [cardError, setCardError] = useState("");
  useEffect(() => setPin(configuredPin), [device.id, configuredPin]);
  const lastSeenAge = device.last_seen_at ? Date.now() - Date.parse(device.last_seen_at) : Number.POSITIVE_INFINITY;
  const online = device.status === "online" && lastSeenAge < 90_000;
  const reportedOn = typeof report?.state?.relay_on === "boolean" ? report.state.relay_on : null;
  const desiredOn = config.desired_on === true;

  async function saveConfig(nextConfig: Record<string, unknown>) {
    setBusy(true);
    setCardError("");
    try {
      await onUpdate(nextConfig);
    } catch (caught) {
      setCardError(caught instanceof Error ? caught.message : "পরিবর্তন সংরক্ষণ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  return <article className="gpio-light-card">
    <div className="gpio-light-top"><span className="gpio-light-icon" aria-hidden="true">✳</span><span className={`device-status${online ? " device-status-online" : ""}`}><i />{online ? "অনলাইন" : "অফলাইন"}</span></div>
    <h3>{device.name}</h3>
    <p className="gpio-light-room">{device.room_id ? "রুমে স্থাপিত" : "রুম নির্ধারিত নয়"} · GPIO {configuredPin}</p>
    <div className="gpio-pin-row"><label htmlFor={`gpio-${device.id}`}>Output pin</label><select id={`gpio-${device.id}`} value={pin} onChange={(event) => setPin(Number(event.target.value))} disabled={busy}>{ESP32_S3_OUTPUT_GPIO_PINS.filter((candidate) => !usedPins.includes(candidate) || candidate === configuredPin).map((candidate) => <option key={candidate} value={candidate}>GPIO {candidate}</option>)}</select><button type="button" className="gpio-save-button" disabled={busy || pin === configuredPin} onClick={() => void saveConfig({ ...config, gpio: pin })}>{busy ? "…" : "সংরক্ষণ"}</button></div>
    <div className="gpio-switch-row"><div><strong>লাইট</strong><small>{reportedOn === null ? "ডিভাইসের রিপোর্ট অপেক্ষমাণ" : `এখন ${reportedOn ? "অন" : "অফ"}`}</small></div><button type="button" role="switch" aria-checked={desiredOn} aria-label={`${device.name} ${desiredOn ? "বন্ধ" : "চালু"} করুন`} className={`gpio-switch${desiredOn ? " is-on" : ""}`} disabled={busy} onClick={() => void saveConfig({ ...config, desired_on: !desiredOn })}><i /></button></div>
    {cardError && <p className="gpio-card-error" role="alert">{cardError}</p>}
    <details className="gpio-device-details"><summary>ESP32 account যাচাই</summary><small>এই light-টি যাচাইকৃত ISYEN ID-র অধীনে</small><code>{isyenId}</code><small>একটি ESP32 setup-এর পর এই account-এর সব light নিজে খুঁজে নেবে—এখানে প্রতি light-এর Device ID দিতে হবে না।</small></details>
  </article>;
}

function ProtocolSensorCard({ device }: { device: Device }) {
  const config = device.config ?? {};
  const model = String(config.sensor_key ?? "Sensor").replaceAll("_", " ").toUpperCase();
  const wiring = config.connection === "i2c" ? `I²C · SDA GPIO ${config.sda_gpio} / SCL GPIO ${config.scl_gpio} · ${config.i2c_address}` : `GPIO ${config.data_gpio}`;
  return <article className="sensor-card"><div className="sensor-card-top"><span className="sensor-card-icon" aria-hidden="true">◉</span><span className="sensor-state-pill"><i />{config.enabled === true ? "Firmware অপেক্ষমাণ" : "বন্ধ"}</span></div><div className="sensor-card-title"><h3>{device.name}</h3><p>{model} · {wiring}</p></div><div className="sensor-reading-display sensor-reading-empty"><span>সর্বশেষ রিডিং</span><strong>Firmware protocol update-এর অপেক্ষায়</strong><small>Model-specific config সংরক্ষিত; এখনো live value নেই।</small></div><div className="sensor-enable-row"><span><strong>Sampling interval</strong><small>প্রতি {String(config.sampling_interval_seconds)} সেকেন্ড · {config.temperature_unit === "fahrenheit" ? "°F" : "°C"}</small></span><span className="sensor-state-pill">{config.enabled === true ? "চালু" : "বন্ধ"}</span></div></article>;
}
function GpioSensorCard({ device, usedPins, reading, onUpdate }: { device: Device; usedPins: number[]; reading?: SensorReading; onUpdate: (config: Record<string, unknown>) => Promise<Device> }) {
  const config = device.config ?? {};
  const configuredPin = typeof config.gpio === "number" ? config.gpio : null;
  const [pin, setPin] = useState<number | "">(configuredPin ?? "");
  const [busy, setBusy] = useState(false);
  const [cardError, setCardError] = useState("");
  useEffect(() => setPin(configuredPin ?? ""), [device.id, configuredPin]);
  const inputMode = config.input_mode === "analog" ? "analog" : "digital";
  const supportedPins = inputMode === "analog" ? ESP32_S3_ANALOG_INPUT_GPIO_PINS : ESP32_S3_DIGITAL_INPUT_GPIO_PINS;
  const availablePins = supportedPins.filter((candidate) => !usedPins.includes(candidate) || candidate === configuredPin);
  const enabled = config.enabled === true;
  const interval = typeof config.sample_interval_ms === "number" ? config.sample_interval_ms : 5000;
  const age = reading ? Date.now() - Date.parse(reading.recorded_at) : Number.POSITIVE_INFINITY;
  const fresh = Boolean(reading) && age <= Math.max(interval * 3, 60_000);
  const visibleValue = reading?.value_text ?? (typeof reading?.value_numeric === "number"
    ? `${reading.value_numeric.toLocaleString("bn-BD", { maximumFractionDigits: 2 })}${reading.unit ? ` ${reading.unit}` : ""}`
    : null);

  async function saveConfig(nextConfig: Record<string, unknown>) {
    setBusy(true);
    setCardError("");
    try {
      await onUpdate(nextConfig);
    } catch (caught) {
      setCardError(caught instanceof Error ? caught.message : "সেন্সর পরিবর্তন সংরক্ষণ করা যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  return <article className="sensor-card">
    <div className="sensor-card-top"><span className="sensor-card-icon" aria-hidden="true">◉</span><span className={`sensor-state-pill${fresh ? " sensor-state-fresh" : ""}`}><i />{!enabled ? "বন্ধ" : reading ? fresh ? "লাইভ" : "পুরোনো ডেটা" : "ডেটার অপেক্ষায়"}</span></div>
    <div className="sensor-card-title"><h3>{device.name}</h3><p>{typeof config.metric === "string" ? config.metric : ""} · {inputMode === "analog" ? "Analog input" : "Digital input"}</p></div>
    <div className={`sensor-reading-display${!reading ? " sensor-reading-empty" : ""}`} aria-live="polite">
      <span>সর্বশেষ রিডিং</span>
      <strong>{visibleValue ?? (enabled ? "এখনো ডেটা আসেনি" : "Sensor বন্ধ")}</strong>
      {reading && <small title={new Date(reading.recorded_at).toLocaleString("bn-BD")}>{new Date(reading.recorded_at).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>}
    </div>
    <div className="sensor-config-row"><label htmlFor={`sensor-gpio-${device.id}`}>Input pin</label><select id={`sensor-gpio-${device.id}`} value={pin} onChange={(event) => setPin(event.target.value ? Number(event.target.value) : "")} disabled={busy}><option value="" disabled>Pin নির্বাচন</option>{availablePins.map((candidate) => <option key={candidate} value={candidate}>GPIO {candidate}</option>)}</select><button type="button" className="gpio-save-button" disabled={busy || pin === "" || pin === configuredPin} onClick={() => void saveConfig({ ...config, gpio: pin })}>{busy ? "…" : "সংরক্ষণ"}</button></div>
    <div className="sensor-enable-row"><span><strong>Sampling</strong><small>{inputMode === "analog" ? "ADC 0–4095" : `প্রতি ${Math.round(interval / 1000)} সেকেন্ড`}</small></span><button type="button" role="switch" aria-checked={enabled} aria-label={`${device.name} sampling ${enabled ? "বন্ধ" : "চালু"} করুন`} className={`gpio-switch${enabled ? " is-on" : ""}`} disabled={busy} onClick={() => void saveConfig({ ...config, enabled: !enabled })}><i /></button></div>
    {cardError && <p className="gpio-card-error" role="alert">{cardError}</p>}
  </article>;
}

function SensorCreateDialog({ draft, rooms, pins, error, loading, onChange, onClose, onSubmit }: {
  draft: DraftSensor;
  rooms: Room[];
  pins: readonly number[];
  error: string;
  loading: boolean;
  onChange: (value: DraftSensor) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}>
    <section className="home-modal sensor-modal" role="dialog" aria-modal="true" aria-labelledby="sensor-modal-title">
      <button className="modal-close" type="button" aria-label="বন্ধ করুন" onClick={onClose} disabled={loading}>×</button>
      <span className="setup-kicker">ESP32-S3 · GPIO SENSOR</span>
      <h2 id="sensor-modal-title">সেন্সর কনফিগার করুন</h2>
      <p>এখানে তৈরি sensor কেবল আপনার ISYEN account-এর হবে। Firmware একই account token দিয়ে config নেবে এবং এর আসল reading এখানে পাঠাবে।</p>
      <form className="home-create-form" onSubmit={onSubmit}>
        <label className="form-field"><span>সেন্সরের নাম <b>*</b></span><input autoFocus required maxLength={120} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></label>
        {rooms.length > 0 && <label className="form-field"><span>রুম</span><select value={draft.room_id} onChange={(event) => onChange({ ...draft, room_id: event.target.value })}><option value="">রুম নির্ধারণ করব পরে</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>}
        <label className="form-field"><span>সেন্সরের মডেল <b>*</b></span><select required value={draft.sensor_key} onChange={(event) => onChange({ ...draft, sensor_key: event.target.value as DraftSensor["sensor_key"], input_mode: "", gpio: "" })}><option value="">মডেল বাছুন</option><option value="dht11_temperature_humidity">DHT11 · তাপমাত্রা + আর্দ্রতা</option><option value="dht22_temperature_humidity">DHT22 · তাপমাত্রা + আর্দ্রতা</option><option value="sensor_bmp180">BMP180 · তাপমাত্রা + চাপ</option><option value="sensor_bmp280">BMP280 · তাপমাত্রা + চাপ</option><option value="sensor_bmp388">BMP388 · তাপমাত্রা + চাপ</option><option value="sensor_bmp390">BMP390 · তাপমাত্রা + চাপ</option><option value="">────────</option><option value="gpio">Generic ESP32-S3 GPIO sensor</option></select></label>
        {draft.sensor_key === "gpio" && <>
          <label className="form-field"><span>ইনপুট ধরন <b>*</b></span><select required value={draft.input_mode} onChange={(event) => onChange({ ...draft, input_mode: event.target.value as DraftSensor["input_mode"], gpio: "", pull_mode: "none" })}><option value="">Analog বা Digital বাছুন</option><option value="analog">Analog input — ADC</option><option value="digital">Digital input — HIGH / LOW</option></select></label>
          <label className="form-field"><span>ESP32-S3 GPIO input pin <b>*</b></span><select required disabled={!draft.input_mode || pins.length === 0} value={draft.gpio} onChange={(event) => onChange({ ...draft, gpio: event.target.value })}><option value="">খালি pin বাছুন</option>{pins.map((pinNumber) => <option key={pinNumber} value={pinNumber}>GPIO {pinNumber}</option>)}</select></label>
          {draft.input_mode === "digital" && <label className="form-field"><span>Internal pull resistor</span><select value={draft.pull_mode} onChange={(event) => onChange({ ...draft, pull_mode: event.target.value as DraftSensor["pull_mode"] })}><option value="none">None</option><option value="up">Pull-up</option><option value="down">Pull-down</option></select></label>}
          <div className="form-grid sensor-form-grid"><label className="form-field"><span>Metric key <b>*</b></span><input required maxLength={40} pattern="[a-z][a-z0-9_]{0,39}" autoCapitalize="none" autoCorrect="off" placeholder="soil_moisture" value={draft.metric} onChange={(event) => onChange({ ...draft, metric: event.target.value.toLowerCase() })} /></label><label className="form-field"><span>Unit</span><input maxLength={20} placeholder="% / °C / raw" value={draft.unit} onChange={(event) => onChange({ ...draft, unit: event.target.value })} /></label></div>
          <label className="form-field"><span>Sampling interval (ms) <b>*</b></span><input required type="number" min={1000} max={60000} step={1000} value={draft.sample_interval_ms} onChange={(event) => onChange({ ...draft, sample_interval_ms: event.target.value })} /></label>
        </>}
        {draft.sensor_key && draft.sensor_key !== "gpio" && <>
          {draft.sensor_key.startsWith("dht") ? <label className="form-field"><span>DHT data GPIO <b>*</b></span><select required value={draft.gpio} onChange={(event) => onChange({ ...draft, gpio: event.target.value })}><option value="">Pin বাছুন</option>{pins.map((pinNumber) => <option key={pinNumber} value={pinNumber}>GPIO {pinNumber}</option>)}</select></label> : <div className="form-grid sensor-form-grid"><label className="form-field"><span>I²C SDA GPIO <b>*</b></span><select value={draft.sda_gpio} onChange={(event) => onChange({ ...draft, sda_gpio: event.target.value })}>{pins.map((pin) => <option key={pin} value={pin}>GPIO {pin}</option>)}</select></label><label className="form-field"><span>I²C SCL GPIO <b>*</b></span><select value={draft.scl_gpio} onChange={(event) => onChange({ ...draft, scl_gpio: event.target.value })}>{pins.map((pin) => <option key={pin} value={pin}>GPIO {pin}</option>)}</select></label><label className="form-field"><span>I²C address</span><select value={draft.i2c_address} onChange={(event) => onChange({ ...draft, i2c_address: event.target.value as DraftSensor["i2c_address"] })}><option value="0x76">0x76</option><option value="0x77">0x77</option></select></label></div>}
          <div className="form-grid sensor-form-grid"><label className="form-field"><span>Sampling interval (seconds) <b>*</b></span><input required type="number" min={2} max={86400} value={draft.sampling_interval_seconds} onChange={(event) => onChange({ ...draft, sampling_interval_seconds: event.target.value })} /></label><label className="form-field"><span>Temperature unit</span><select value={draft.temperature_unit} onChange={(event) => onChange({ ...draft, temperature_unit: event.target.value as DraftSensor["temperature_unit"] })}><option value="celsius">Celsius (°C)</option><option value="fahrenheit">Fahrenheit (°F)</option></select></label></div>
          <p className="field-note">সেন্সর মডেল ও wiring configuration সংরক্ষণ হবে। আসল রিডিং পেতে firmware-এ সংশ্লিষ্ট protocol driver পরে যোগ/আপডেট করতে হবে।</p>
        </>}
        {!pins.length && draft.input_mode && <p className="form-alert" role="alert">এই account-এর জন্য এই mode-এ আর খালি pin নেই। অন্য Home-এর lights/sensors-ও একই ESP32 pin ভাগ করে ব্যবহার করতে পারে না।</p>}
        <p className="field-note">Analog mode কেবল GPIO 1, 2 ও 4–10 (ADC1) ব্যবহার করে। 3.3V-এর বেশি voltage সরাসরি ESP32 pin-এ দেবেন না। Sensor-এ কোনো fake/default reading যোগ হবে না।</p>
        {error && <p className="form-alert" role="alert">{error}</p>}
        <div className="home-modal-actions"><button className="outline-action" type="button" onClick={onClose} disabled={loading}>বাতিল</button><button className="primary-button" type="submit" disabled={loading || !draft.sensor_key || (draft.sensor_key === "gpio" && (!draft.input_mode || !draft.gpio)) || (draft.sensor_key.startsWith("dht") && !draft.gpio) || (draft.sensor_key.startsWith("sensor_bmp") && draft.sda_gpio === draft.scl_gpio)}>{loading ? <><span className="button-spinner" /> সংরক্ষণ হচ্ছে…</> : <>সেন্সর সংরক্ষণ <span aria-hidden="true">→</span></>}</button></div>
      </form>
    </section>
  </div>;
}

function StatCard({ icon, label, value, foot, tone }: { icon: string; label: string; value: number; foot: string; tone: string }) {
  return <article className="smart-stat-card"><span className={`stat-icon stat-${tone}`} aria-hidden="true">{icon}</span><span className="stat-label">{label}</span><strong>{value.toLocaleString("bn-BD")}</strong><small>{foot}</small></article>;
}

function EmptyPanel({ icon, title, description, compact = false }: { icon: string; title: string; description: string; compact?: boolean }) {
  return <div className={`dashboard-empty${compact ? " dashboard-empty-compact" : ""}`}><span className="empty-panel-icon" aria-hidden="true">{icon}</span><div><strong>{title}</strong><p>{description}</p></div></div>;
}

function homeAddress(home: Home) {
  const address = home.address ?? {};
  return [address.address_line_1, address.city, address.country].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(", ");
}

function deviceGlyph(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("light") || normalized.includes("lamp") || normalized.includes("আলো")) return "✳";
  if (normalized.includes("lock") || normalized.includes("door") || normalized.includes("লক")) return "⌑";
  if (normalized.includes("sensor") || normalized.includes("সেন্সর")) return "◉";
  return "⌂";
}
