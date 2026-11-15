import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loading } from "./Feedback";
import { requestBackendEndpoint } from "./request";
import { getDashboard, getReadings } from "./dashboardApi";
import OverviewSection from "./Overview";
import DevicesSection from "./Devices";
import SensorsSection from "./Sensors";
import AutomationSection from "./Automations";
import DashboardBackground from "./DashboardBackground";
const DASHBOARD_SECTIONS = [
  { id: "overview", label: "Control Panel", href: "/dashboard" },
  { id: "device", label: "Devices", href: "/dashboard/device" },
  { id: "sensor", label: "Sensors", href: "/dashboard/sensor" },
  { id: "automation", label: "Automations", href: "/dashboard/automation" },
];
const SECTION_TITLES = {
  overview: "Control Panel",
  device: "Devices",
  sensor: "Sensors",
  automation: "Automations",
};

export default function DashboardShell({ user, session, onLogout, notify, section = "overview" }) {
  const [data, setData] = useState({ gateways: [], nodes: [], devices: [], sensors: [], automations: [], readings: {} });
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const requestApi = useCallback((path, options = {}) => requestBackendEndpoint(session.access_token, path, options), [session.access_token]);
  const refresh = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true); setError("");
    try { const result = await getDashboard(requestApi); const readings = {}; (result.readings || []).forEach((reading) => { if (reading.sensor_id != null) readings[reading.sensor_id] = reading; }); setData({ gateways: result.gateways || [], nodes: result.nodes || [], devices: result.devices || [], sensors: result.sensors || [], automations: result.automations || [], readings }); }
    catch (error) { setError(error.message); } finally { if (showLoading) setLoading(false); }
  }, [requestApi]);
  useEffect(() => { void refresh({ showLoading: true }); }, [refresh]);
  useEffect(() => { const timer = setInterval(() => void refresh(), 15000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => {
    const hasFast = data.sensors.some((sensor) => ["PIR", "REED", "WATER_LEAK", "TOUCH"].includes(sensor.sensor_type));
    const hasSlow = data.sensors.some((sensor) => !["PIR", "REED", "WATER_LEAK", "TOUCH"].includes(sensor.sensor_type));
    if (!hasFast && !hasSlow) return; let active = true;
    const poll = async (type) => { try { const result = await getReadings(requestApi, type); if (!active) return; setData((current) => { const readings = { ...current.readings }; (result.readings || []).forEach((reading) => { if (reading.sensor_id != null) readings[reading.sensor_id] = reading; }); return { ...current, readings }; }); } catch (error) { console.debug(error); } };
    const fast = hasFast ? setInterval(() => poll("fast"), 3000) : null; const slow = hasSlow ? setInterval(() => poll("slow"), 20000) : null;
    return () => { active = false; clearInterval(fast); clearInterval(slow); };
  }, [data.sensors, requestApi]);
  return (
    <DashboardBackground>
      <main className="workspace" data-section={section}>
        <section className="dashboard-heading" aria-labelledby="dashboard-title"><div><p className="eyebrow">ISYEN · HOME CONTROL</p><h1 id="dashboard-title">{SECTION_TITLES[section] || "Dashboard"}</h1></div><div className="profile"><div className="avatar">IS</div><div className="profile-meta"><b>{user.email}</b><small>Account</small></div><button className="btn btn-quiet" onClick={onLogout}>Sign out</button></div></section>
        <nav className="dashboard-section-nav" aria-label="Dashboard sections">{DASHBOARD_SECTIONS.map((item) => <Link key={item.id} href={item.href} className={section === item.id ? "active" : undefined} aria-current={section === item.id ? "page" : undefined}>{item.label}</Link>)}</nav>
        {loading ? <Loading /> : error ? <div className="error-panel" role="alert"><span className="error-mark">!</span><div><h2>Could not load the dashboard</h2><p>{error}</p><button className="btn btn-primary" onClick={() => refresh({ showLoading: true })}>Try again</button></div></div> : <>
          {section === "overview" && <><section className="welcome-row dashboard-welcome-card"><div><p className="eyebrow">Overview</p><h2>Your home at a glance</h2><p className="muted">A quick summary of everything connected.</p></div><span className="sync-label"><i className="live-dot" /> Live updates</span></section><section className="stats-grid" aria-label="Summary"><Stat icon="⌘" tint="teal" label="Gateways" value={data.gateways.length} /><Stat icon="⌂" tint="violet" label="Approved Sub Nodes" value={data.nodes.filter((node) => node.is_approved).length} /><Stat icon="◈" tint="amber" label="Devices" value={data.devices.length} /><Stat icon="⌁" tint="blue" label="Sensors" value={data.sensors.length} /></section><section className="card-grid dashboard-overview-grid" aria-label="Open a dashboard section"><Link className="card dashboard-overview-card" href="/dashboard/device"><span className="eyebrow">GPIO Controls</span><strong>Devices</strong><span className="dashboard-overview-count">{data.devices.length}</span><span className="muted">Control devices and configure their pins.</span></Link><Link className="card dashboard-overview-card" href="/dashboard/sensor"><span className="eyebrow">Monitoring</span><strong>Sensors</strong><span className="dashboard-overview-count">{data.sensors.length}</span><span className="muted">View readings and manage sensors.</span></Link><Link className="card dashboard-overview-card" href="/dashboard/automation"><span className="eyebrow">Rules &amp; Actions</span><strong>Automations</strong><span className="dashboard-overview-count">{data.automations.length}</span><span className="muted">Connect sensor conditions to device actions.</span></Link></section><OverviewSection gateways={data.gateways} nodes={data.nodes} devices={data.devices} sensors={data.sensors} request={requestApi} onRefresh={refresh} notify={notify} /></>}
          {section === "device" && <DevicesSection items={data.devices} gateways={data.gateways} nodes={data.nodes} request={requestApi} onRefresh={refresh} notify={notify} />}
          {section === "sensor" && <SensorsSection items={data.sensors} gateways={data.gateways} nodes={data.nodes} readings={data.readings} request={requestApi} onRefresh={refresh} notify={notify} />}
          {section === "automation" && <AutomationSection gateways={data.gateways} sensors={data.sensors} devices={data.devices} automations={data.automations} request={requestApi} onRefresh={refresh} notify={notify} />}
        </>}
      </main>
    </DashboardBackground>
  );
}
function Stat({ icon, tint, label, value }) {
  return (
    <article className="stat-card">
      <span className={`stat-icon ${tint}`}>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
