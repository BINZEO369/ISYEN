import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_BASE_URL, DEVICE_PINS, SENSOR_PINS } from "../services/config";
import { Loading, Modal } from "./Feedback";
import {
  DeviceCards,
  GatewayCards,
  NodeCards,
  SensorCards,
} from "./ResourceCards";

const TYPES = ["DHT11", "DHT22", "MQ2", "MQ135", "PIR", "REED"];
const DASHBOARD_SECTIONS = [
  { id: "overview", label: "Dashboard", href: "/dashboard" },
  { id: "device", label: "Devices", href: "/dashboard/device" },
  { id: "sensor", label: "Sensors", href: "/dashboard/sensor" },
];
const SECTION_TITLES = {
  overview: "Dashboard",
  device: "Devices",
  sensor: "Sensors",
};

// Dashboard actions call their backend endpoints; Supabase credentials stay on the server.
async function requestBackendEndpoint(accessToken, path, options = {}) {
  if (!accessToken) throw new Error("Your session has expired. Please sign in again.");
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error(error.message || "Could not connect to the server. Check your connection and try again.");
  }
  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error("The server returned an invalid response.");
    }
  }
  if (!response.ok) {
    const message =
      response.status === 401 || response.status === 403
        ? "Your session has expired. Please sign in again."
        : response.status === 404
          ? "The requested item was not found."
          : `Request failed (${response.status}). Please try again.`;
    throw new Error(message);
  }
  return payload;
}

const jsonRequest = (method, body) => ({ method, body: JSON.stringify(body) });
const endpointId = (value) => encodeURIComponent(value);
export default function DashboardShell({
  user,
  session,
  onLogout,
  notify,
  section = "overview",
}) {
  const [data, setData] = useState({
    gateways: [],
    nodes: [],
    devices: [],
    sensors: [],
    readings: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState("");
  const [busy, setBusy] = useState(false);
  const [sensorType, setSensorType] = useState("DHT11");
  const [gatewayId, setGatewayId] = useState("");
  const [nodeId, setNodeId] = useState("0");
  const [trigger, setTrigger] = useState("HIGH");
  const refresh = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const d = await requestBackendEndpoint(session.access_token, "/api/dashboard");
      const readings = {};
      (d.readings || []).forEach((r) => {
        if (r.sensor_id != null) readings[r.sensor_id] = r;
      });
      setData({
        gateways: d.gateways || [],
        nodes: d.nodes || [],
        devices: d.devices || [],
        sensors: d.sensors || [],
        readings,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [session.access_token]);
  useEffect(() => {
    void refresh({ showLoading: true });
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    const hasFast = data.sensors.some((s) =>
        ["PIR", "REED"].includes(s.sensor_type),
      ),
      hasSlow = data.sensors.some(
        (s) => !["PIR", "REED"].includes(s.sensor_type),
      );
    if (!hasFast && !hasSlow) return;
    let active = true;
    const poll = async (type) => {
      try {
        const out = await requestBackendEndpoint(session.access_token, `/api/readings?type=${encodeURIComponent(type)}`);
        if (!active) return;
        setData((d) => {
          const readings = { ...d.readings };
          (out.readings || []).forEach((r) => {
            if (r.sensor_id != null) readings[r.sensor_id] = r;
          });
          return { ...d, readings };
        });
      } catch (e) {
        console.debug(e);
      }
    };
    const fast = hasFast ? setInterval(() => poll("fast"), 3000) : null,
      slow = hasSlow ? setInterval(() => poll("slow"), 20000) : null;
    return () => {
      active = false;
      clearInterval(fast);
      clearInterval(slow);
    };
  }, [data.sensors, session.access_token]);
  const approved = useMemo(
    () =>
      data.nodes.filter(
        (n) => n.is_approved && String(n.gateway_id) === String(gatewayId),
      ),
    [data.nodes, gatewayId],
  );
  const subOnly = ["PIR", "REED"].includes(sensorType);
  const allowedNodes = subOnly
    ? approved
    : [{ id: "0", node_name: "Main ESP32 (Gateway)" }, ...approved];
  function startModal(name) {
    if (["device", "sensor"].includes(name) && !data.gateways.length) {
      notify("Add a gateway first.", true);
      return;
    }
    setModal(name);
    setBusy(false);
    setGatewayId(data.gateways[0] ? String(data.gateways[0].id) : "");
    setNodeId("0");
    setSensorType("DHT11");
    setTrigger("HIGH");
  }
  async function run(action, success) {
    try {
      await action();
      setModal("");
      notify(success);
      await refresh();
    } catch (e) {
      notify(e.message, true);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (modal === "gateway") {
        const result = await requestBackendEndpoint(
          session.access_token,
          "/api/gateways",
          jsonRequest("POST", { gateway_name: String(f.get("name")).trim() }),
        );
        setModal("");
        notify(
          `Gateway created${result?.claim_code ? ` · Claim Code ${result.claim_code}` : ""}`,
        );
        await refresh();
      } else if (modal === "device") {
        const pin = Number(f.get("pin"));
        if (!DEVICE_PINS.includes(pin))
          throw new Error("Select a valid GPIO pin.");
        await requestBackendEndpoint(session.access_token, "/api/devices", jsonRequest("POST", {
          gateway_id: Number(f.get("gateway")),
          node_id: Number(f.get("node")),
          device_name: String(f.get("name")).trim(),
          pin,
        }));
        setModal("");
        notify("Device added.");
        await refresh();
      } else if (modal === "sensor") {
        const pin = Number(f.get("pin")),
          node = Number(f.get("node"));
        if (!SENSOR_PINS.includes(pin))
          throw new Error("Select a valid GPIO pin.");
        if (
          subOnly &&
          (!node || !approved.some((n) => String(n.id) === String(node)))
        )
          throw new Error(
            `${sensorType} can only be assigned to an approved Sub Node.`,
          );
        await requestBackendEndpoint(session.access_token, "/api/sensors", jsonRequest("POST", {
          gateway_id: Number(f.get("gateway")),
          node_id: node,
          sensor_name: String(f.get("name")).trim(),
          pin,
          sensor_type: sensorType,
          pir_trigger_state: trigger,
        }));
        setModal("");
        notify("Sensor added.");
        await refresh();
      }
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }
  async function approve(n) {
    const name = window.prompt("Enter a name for this Node:", "Room Node");
    if (!name?.trim()) return;
    await run(
      () => requestBackendEndpoint(
        session.access_token,
        `/api/nodes/${endpointId(n.id)}`,
        jsonRequest("PATCH", { node_name: name.trim(), is_approved: true }),
      ),
      "Node approved.",
    );
  }
  async function removeNode(n) {
    const devices = data.devices.filter(
        (x) => String(x.node_id) === String(n.id),
      ).length,
      sensors = data.sensors.filter(
        (x) => String(x.node_id) === String(n.id),
      ).length;
    if (
      window.confirm(
        `Delete “${n.node_name || "Node"}”? This will also delete ${devices} device${devices === 1 ? "" : "s"} and ${sensors} sensor${sensors === 1 ? "" : "s"}.`,
      )
    )
      await run(
        () => requestBackendEndpoint(session.access_token, `/api/nodes/${endpointId(n.id)}`, { method: "DELETE" }),
        "Node and related resources deleted.",
      );
  }
  async function toggle(d) {
    const on = Array.isArray(d.device_states)
      ? Boolean(d.device_states[0]?.is_on)
      : Boolean(d.device_states?.is_on);
    setData((prev) => ({
      ...prev,
      devices: prev.devices.map((x) =>
        String(x.id) === String(d.id)
          ? { ...x, device_states: [{ is_on: !on }] }
          : x,
      ),
    }));
    try {
      await requestBackendEndpoint(
        session.access_token,
        `/api/devices/${endpointId(d.id)}/state`,
        jsonRequest("PATCH", { is_on: !on }),
      );
      await refresh();
    } catch (e) {
      notify(e.message, true);
      await refresh();
    }
  }
  async function remove(type, item) {
    if (
      !window.confirm(
        type === "device" ? "Delete this device?" : "Delete this sensor?",
      )
    )
      return;
    await run(
      () =>
        type === "device"
          ? requestBackendEndpoint(session.access_token, `/api/devices/${endpointId(item.id)}`, { method: "DELETE" })
          : requestBackendEndpoint(session.access_token, `/api/sensors/${endpointId(item.id)}`, { method: "DELETE" }),
      `${type === "device" ? "Device" : "Sensor"} deleted.`,
    );
  }
  return (
    <div className="app-shell">
      <main className="workspace">
        <section className="dashboard-heading" aria-labelledby="dashboard-title">
          <div>
            <p className="eyebrow">Your Smart Home</p>
            <h1 id="dashboard-title">{SECTION_TITLES[section] || "Dashboard"}</h1>
          </div>
          <div className="profile">
            <div className="avatar">IS</div>
            <div className="profile-meta">
              <b>{user.email}</b>
              <small>Account</small>
            </div>
            <button className="btn btn-quiet" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </section>
        <nav className="dashboard-section-nav" aria-label="Dashboard sections">
          {DASHBOARD_SECTIONS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={section === item.id ? "active" : undefined}
              aria-current={section === item.id ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="error-panel" role="alert">
            <span className="error-mark">!</span>
            <div>
              <h2>Could not load the dashboard</h2>
              <p>{error}</p>
              <button
                className="btn btn-primary"
                onClick={() => refresh({ showLoading: true })}
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <>
            {section === "overview" && (
              <>
                <section className="welcome-row dashboard-welcome-card">
                  <div>
                    <p className="eyebrow">Overview</p>
                    <h2>Your home at a glance</h2>
                    <p className="muted">A quick summary of everything connected.</p>
                  </div>
                  <span className="sync-label">
                    <i className="live-dot" /> Live updates
                  </span>
                </section>
                <section className="stats-grid" aria-label="Summary">
                  <Stat
                    icon="⌘"
                    tint="teal"
                    label="Gateways"
                    value={data.gateways.length}
                  />
                  <Stat
                    icon="⌂"
                    tint="violet"
                    label="Approved Sub Nodes"
                    value={data.nodes.filter((n) => n.is_approved).length}
                  />
                  <Stat
                    icon="☼"
                    tint="amber"
                    label="Devices"
                    value={data.devices.length}
                  />
                  <Stat
                    icon="⌁"
                    tint="blue"
                    label="Sensors"
                    value={data.sensors.length}
                  />
                </section>
                <section className="card-grid dashboard-overview-grid" aria-label="Open a dashboard section">
                  <Link className="card dashboard-overview-card" href="/dashboard/device">
                    <span className="eyebrow">GPIO Controls</span>
                    <strong>Devices</strong>
                    <span className="dashboard-overview-count">{data.devices.length}</span>
                    <span className="muted">Control devices and configure their pins.</span>
                  </Link>
                  <Link className="card dashboard-overview-card" href="/dashboard/sensor">
                    <span className="eyebrow">Monitoring</span>
                    <strong>Sensors</strong>
                    <span className="dashboard-overview-count">{data.sensors.length}</span>
                    <span className="muted">View readings and manage sensors.</span>
                  </Link>
                </section>
              </>
            )}
            {section === "overview" && (
              <section className="dashboard-block">
                <Heading eyebrow="Connection Management" title="Your Gateways">
                  <button
                    className="btn btn-primary"
                    onClick={() => startModal("gateway")}
                  >
                    ＋ Add Gateway
                  </button>
                </Heading>
                <GatewayCards items={data.gateways} />
              </section>
            )}
            {section === "overview" && (
              <>
                <section className="dashboard-block">
                  <Heading eyebrow="Awaiting Approval" title="Pending Sub Nodes" />
                  <NodeCards
                    items={data.nodes}
                    gateways={data.gateways}
                    pending
                    onApprove={approve}
                  />
                </section>
                <section className="dashboard-block">
                  <Heading eyebrow="Approved Connections" title="Sub Nodes" />
                  <NodeCards
                    items={data.nodes}
                    gateways={data.gateways}
                    onDelete={removeNode}
                  />
                </section>
              </>
            )}
            {section === "device" && (
              <section className="dashboard-block">
                <Heading eyebrow="GPIO Controls" title="Devices">
                  <button
                    className="btn btn-primary"
                    onClick={() => startModal("device")}
                  >
                    ＋ Add Device
                  </button>
                </Heading>
                <p className="muted page-description">
                  Add any GPIO-connected device and choose its pin number.
                </p>
                <DeviceCards
                  items={data.devices}
                  gateways={data.gateways}
                  nodes={data.nodes}
                  onToggle={toggle}
                  onDelete={(d) => remove("device", d)}
                />
              </section>
            )}
            {section === "sensor" && (
              <section className="dashboard-block">
                <Heading eyebrow="Environmental Monitoring" title="Sensors">
                  <button
                    className="btn btn-primary"
                    onClick={() => startModal("sensor")}
                  >
                    ＋ Add Sensor
                  </button>
                </Heading>
                <SensorCards
                  items={data.sensors}
                  gateways={data.gateways}
                  nodes={data.nodes}
                  readings={data.readings}
                  onDelete={(s) => remove("sensor", s)}
                />
              </section>
            )}
          </>
        )}
      </main>
      {modal && (
        <Modal
          title={
            modal === "gateway"
              ? "Add Gateway"
              : modal === "device"
                ? "Add Device"
                : "Add Sensor"
          }
          eyebrow={
            modal === "gateway"
              ? "New Connection"
              : modal === "device"
                ? "Device Setup"
                : "Environmental Monitoring"
          }
          description={
            modal === "gateway"
              ? "A claim code will be generated for your ESP32."
              : null
          }
          onClose={() => setModal("")}
        >
          <form onSubmit={submit}>
            <label htmlFor="resource-name">
              {modal === "gateway"
                ? "Gateway name"
                : modal === "device"
                  ? "Device name"
                  : "Sensor name"}
            </label>
            <input
              id="resource-name"
              name="name"
              required
              maxLength={80}
              placeholder="e.g., Living room fan"
              autoFocus
            />
            {modal !== "gateway" && (
              <>
                <label htmlFor="gateway-select">Gateway</label>
                <select
                  id="gateway-select"
                  name="gateway"
                  required
                  value={gatewayId}
                  onChange={(e) => {
                    setGatewayId(e.target.value);
                    setNodeId("0");
                  }}
                >
                  {data.gateways.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.gateway_name}
                    </option>
                  ))}
                </select>
                <label htmlFor="node-select">Node</label>
                <select
                  id="node-select"
                  name="node"
                  required
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                >
                  {allowedNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.node_name || "Sub Node"}
                    </option>
                  ))}
                </select>
              </>
            )}
            {modal === "device" && (
              <>
                <label htmlFor="device-pin">GPIO Pin</label>
                <select id="device-pin" name="pin">
                  {DEVICE_PINS.map((p) => (
                    <option key={p} value={p}>
                      GPIO {p}
                    </option>
                  ))}
                </select>
              </>
            )}
            {modal === "sensor" && (
              <>
                <label htmlFor="sensor-type">Sensor Type</label>
                <select
                  id="sensor-type"
                  value={sensorType}
                  onChange={(e) => {
                    setSensorType(e.target.value);
                    setNodeId("0");
                  }}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                      {t === "PIR"
                        ? " · motion (Sub Node only)"
                        : t === "REED"
                          ? " · door/window (Sub Node only)"
                          : t.startsWith("DHT")
                            ? " · temperature and humidity"
                            : t === "MQ2"
                              ? " · gas"
                              : " · air quality"}
                    </option>
                  ))}
                </select>
                {subOnly && (
                  <div className="conditional">
                    <label htmlFor="trigger-state">
                      {sensorType === "PIR"
                        ? "Motion Trigger"
                        : "Open Detection"}
                    </label>
                    <select
                      id="trigger-state"
                      value={trigger}
                      onChange={(e) => setTrigger(e.target.value)}
                    >
                      <option value="HIGH">HIGH — pin is HIGH when triggered</option>
                      <option value="LOW">LOW — pin is LOW when triggered</option>
                    </select>
                    <p className="hint">
                      {sensorType === "PIR"
                        ? "Use HIGH for the HC-SR501."
                        : "Use HIGH for a standard NO reed switch with internal pull-up."}
                    </p>
                  </div>
                )}
                {subOnly && !approved.length && (
                  <p className="warning" role="alert">
                    {sensorType} sensors require at least one approved Sub Node on this Gateway.
                  </p>
                )}
                <label htmlFor="sensor-pin">GPIO Pin</label>
                <select id="sensor-pin" name="pin">
                  {SENSOR_PINS.map((p) => (
                    <option key={p} value={p}>
                      GPIO {p}
                    </option>
                  ))}
                </select>
              </>
            )}
            <div className="modal-actions">
              <button
                className="btn btn-quiet"
                type="button"
                onClick={() => setModal("")}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={
                  busy || (modal === "sensor" && subOnly && !approved.length)
                }
              >
                {busy
                  ? "Saving…"
                  : modal === "gateway"
                    ? "Generate Claim Code"
                    : modal === "device"
                      ? "Add Device"
                      : "Add Sensor"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
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
function Heading({ eyebrow, title, children }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
