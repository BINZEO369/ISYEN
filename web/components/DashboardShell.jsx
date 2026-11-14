import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL, DEVICE_PINS, SENSOR_PINS } from "../services/config";
import { Loading, Modal } from "./Feedback";
import {
  DeviceCards,
  GatewayCards,
  NodeCards,
  SensorCards,
} from "./ResourceCards";

const TYPES = ["DHT11", "DHT22", "MQ2", "MQ135", "PIR", "REED"];

// Dashboard actions call their backend endpoints; Supabase credentials stay on the server.
async function requestBackendEndpoint(accessToken, path, options = {}) {
  if (!accessToken) throw new Error("আপনার সেশন শেষ হয়েছে। আবার লগ ইন করুন।");
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error(error.message || "সার্ভারের সঙ্গে সংযোগ করা যাচ্ছে না।");
  }
  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error("সার্ভার থেকে সঠিক JSON উত্তর আসেনি।");
    }
  }
  if (!response.ok) {
    const message = payload?.error || payload?.message || payload?.details ||
      `অনুরোধ ব্যর্থ হয়েছে (${response.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return payload;
}

const jsonRequest = (method, body) => ({ method, body: JSON.stringify(body) });
const endpointId = (value) => encodeURIComponent(value);
export default function DashboardShell({ user, session, onLogout, notify }) {
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
  const [mobileNav, setMobileNav] = useState(false);
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
      notify("আগে একটি Gateway যোগ করুন।", true);
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
          `Gateway তৈরি হয়েছে${result?.claim_code ? ` · Claim Code ${result.claim_code}` : ""}`,
        );
        await refresh();
      } else if (modal === "device") {
        const pin = Number(f.get("pin"));
        if (!DEVICE_PINS.includes(pin))
          throw new Error("নিরাপদ GPIO Pin নির্বাচন করুন।");
        await requestBackendEndpoint(session.access_token, "/api/devices", jsonRequest("POST", {
          gateway_id: Number(f.get("gateway")),
          node_id: Number(f.get("node")),
          device_name: String(f.get("name")).trim(),
          pin,
        }));
        setModal("");
        notify("ডিভাইস যোগ হয়েছে।");
        await refresh();
      } else if (modal === "sensor") {
        const pin = Number(f.get("pin")),
          node = Number(f.get("node"));
        if (!SENSOR_PINS.includes(pin))
          throw new Error("নিরাপদ GPIO Pin নির্বাচন করুন।");
        if (
          subOnly &&
          (!node || !approved.some((n) => String(n.id) === String(node)))
        )
          throw new Error(
            `${sensorType} শুধু অনুমোদিত Sub Node-এ যোগ করা যাবে।`,
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
        notify("সেন্সর যোগ হয়েছে।");
        await refresh();
      }
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }
  async function approve(n) {
    const name = window.prompt("এই Node-এর নাম লিখুন:", "Room Node");
    if (!name?.trim()) return;
    await run(
      () => requestBackendEndpoint(
        session.access_token,
        `/api/nodes/${endpointId(n.id)}`,
        jsonRequest("PATCH", { node_name: name.trim(), is_approved: true }),
      ),
      "Node অনুমোদিত হয়েছে।",
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
        `“${n.node_name || "Node"}” মুছবেন? এর সঙ্গে ${devices}টি ডিভাইস ও ${sensors}টি সেন্সরও মুছে যাবে।`,
      )
    )
      await run(
        () => requestBackendEndpoint(session.access_token, `/api/nodes/${endpointId(n.id)}`, { method: "DELETE" }),
        "Node ও সংশ্লিষ্ট resources মুছে ফেলা হয়েছে।",
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
        type === "device" ? "এই ডিভাইসটি মুছবেন?" : "এই সেন্সরটি মুছবেন?",
      )
    )
      return;
    await run(
      () =>
        type === "device"
          ? requestBackendEndpoint(session.access_token, `/api/devices/${endpointId(item.id)}`, { method: "DELETE" })
          : requestBackendEndpoint(session.access_token, `/api/sensors/${endpointId(item.id)}`, { method: "DELETE" }),
      `${type === "device" ? "ডিভাইস" : "সেন্সর"} মুছে ফেলা হয়েছে।`,
    );
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "nav-open" : ""}`}>
        <a className="brand" href="#overview">
          <span className="brand-mark small">ন</span>
          <span>
            নিবাস<small>SMART HOME</small>
          </span>
        </a>
        <button
          className="menu-toggle"
          aria-label="নেভিগেশন দেখান"
          aria-expanded={mobileNav}
          onClick={() => setMobileNav(!mobileNav)}
        >
          ☰
        </button>
        <nav aria-label="প্রধান নেভিগেশন" onClick={() => setMobileNav(false)}>
          <a className="nav-link active" href="#overview">
            <b>◈</b>
            <span>ড্যাশবোর্ড</span>
          </a>
          <a className="nav-link" href="#gateways">
            <b>⌘</b>
            <span>Gateways</span>
          </a>
          <a className="nav-link" href="#devices">
            <b>☼</b>
            <span>ডিভাইস</span>
          </a>
          <a className="nav-link" href="#sensors">
            <b>⌁</b>
            <span>সেন্সর</span>
          </a>
        </nav>
        <div className="sidebar-bottom">
          <span className="live-dot" />
          <span>
            সিস্টেম সচল<small>লাইভ সংযোগ</small>
          </span>
        </div>
      </aside>
      <main className="workspace">
        <div className="topbar">
          <div>
            <p className="eyebrow">আপনার স্মার্ট হোম</p>
            <h1>ড্যাশবোর্ড</h1>
          </div>
          <div className="profile">
            <div className="avatar">IS</div>
            <div className="profile-meta">
              <b>{user.email}</b>
              <small>অ্যাকাউন্ট</small>
            </div>
            <button className="btn btn-quiet" onClick={onLogout}>
              লগ আউট
            </button>
          </div>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="error-panel" role="alert">
            <span className="error-mark">!</span>
            <div>
              <h2>ড্যাশবোর্ড লোড করা যায়নি</h2>
              <p>{error}</p>
              <button
                className="btn btn-primary"
                onClick={() => refresh({ showLoading: true })}
              >
                আবার চেষ্টা করুন
              </button>
            </div>
          </div>
        ) : (
          <>
            <section id="overview" className="welcome-row">
              <div>
                <p className="eyebrow">শুভেচ্ছা</p>
                <h2>আপনার বাড়ির অবস্থা</h2>
                <p className="muted">সংযুক্ত সবকিছুর এক নজরের সারাংশ।</p>
              </div>
              <span className="sync-label">
                <i className="live-dot" /> লাইভ আপডেট
              </span>
            </section>
            <section className="stats-grid" aria-label="সারাংশ">
              <Stat
                icon="⌘"
                tint="teal"
                label="Gateways"
                value={data.gateways.length}
              />
              <Stat
                icon="⌂"
                tint="violet"
                label="অনুমোদিত Sub Nodes"
                value={data.nodes.filter((n) => n.is_approved).length}
              />
              <Stat
                icon="☼"
                tint="amber"
                label="ডিভাইস"
                value={data.devices.length}
              />
              <Stat
                icon="⌁"
                tint="blue"
                label="সেন্সর"
                value={data.sensors.length}
              />
            </section>
            <section id="gateways">
              <Heading eyebrow="সংযোগ ব্যবস্থাপনা" title="আপনার Gateways">
                <button
                  className="btn btn-primary"
                  onClick={() => startModal("gateway")}
                >
                  ＋ Gateway যোগ করুন
                </button>
              </Heading>
              <GatewayCards items={data.gateways} />
            </section>
            <section>
              <Heading eyebrow="অনুমোদনের অপেক্ষায়" title="নতুন Sub Nodes" />
              <NodeCards
                items={data.nodes}
                gateways={data.gateways}
                pending
                onApprove={approve}
              />
            </section>
            <section>
              <Heading eyebrow="অনুমোদিত সংযোগ" title="Sub Nodes" />
              <NodeCards
                items={data.nodes}
                gateways={data.gateways}
                onDelete={removeNode}
              />
            </section>
            <section id="devices">
              <Heading eyebrow="নিয়ন্ত্রণ" title="আলো ও ডিভাইস">
                <button
                  className="btn btn-primary"
                  onClick={() => startModal("device")}
                >
                  ＋ ডিভাইস যোগ করুন
                </button>
              </Heading>
              <DeviceCards
                items={data.devices}
                gateways={data.gateways}
                nodes={data.nodes}
                onToggle={toggle}
                onDelete={(d) => remove("device", d)}
              />
            </section>
            <section id="sensors">
              <Heading eyebrow="পরিবেশ পর্যবেক্ষণ" title="সেন্সর">
                <button
                  className="btn btn-primary"
                  onClick={() => startModal("sensor")}
                >
                  ＋ সেন্সর যোগ করুন
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
          </>
        )}
      </main>
      {modal && (
        <Modal
          title={
            modal === "gateway"
              ? "Gateway যোগ করুন"
              : modal === "device"
                ? "আলো / ডিভাইস যোগ করুন"
                : "সেন্সর যোগ করুন"
          }
          eyebrow={
            modal === "gateway"
              ? "নতুন সংযোগ"
              : modal === "device"
                ? "ডিভাইস সেটআপ"
                : "পরিবেশ পর্যবেক্ষণ"
          }
          description={
            modal === "gateway"
              ? "আপনার ESP32-তে ব্যবহারের জন্য একটি Claim Code তৈরি হবে।"
              : null
          }
          onClose={() => setModal("")}
        >
          <form onSubmit={submit}>
            <label htmlFor="resource-name">
              {modal === "gateway"
                ? "Gateway-এর নাম"
                : modal === "device"
                  ? "ডিভাইসের নাম"
                  : "সেন্সরের নাম"}
            </label>
            <input
              id="resource-name"
              name="name"
              required
              maxLength={80}
              placeholder="যেমন: বসার ঘরের আলো"
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
                        ? " · গতি (শুধু Sub Node)"
                        : t === "REED"
                          ? " · দরজা/জানালা (শুধু Sub Node)"
                          : t.startsWith("DHT")
                            ? " · তাপমাত্রা ও আর্দ্রতা"
                            : t === "MQ2"
                              ? " · গ্যাস"
                              : " · বায়ুর মান"}
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
                      <option value="HIGH">HIGH — সক্রিয় হলে pin HIGH</option>
                      <option value="LOW">LOW — সক্রিয় হলে pin LOW</option>
                    </select>
                    <p className="hint">
                      {sensorType === "PIR"
                        ? "HC-SR501-এর জন্য HIGH রাখুন।"
                        : "সাধারণ NO reed + internal pull-up-এ HIGH রাখুন।"}
                    </p>
                  </div>
                )}
                {subOnly && !approved.length && (
                  <p className="warning" role="alert">
                    {sensorType} সেন্সরের জন্য এই Gateway-তে অন্তত একটি অনুমোদিত
                    Sub Node প্রয়োজন।
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
                বাতিল
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={
                  busy || (modal === "sensor" && subOnly && !approved.length)
                }
              >
                {busy
                  ? "সংরক্ষণ হচ্ছে…"
                  : modal === "gateway"
                    ? "Claim Code তৈরি"
                    : modal === "device"
                      ? "ডিভাইস যোগ করুন"
                      : "সেন্সর যোগ করুন"}
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
