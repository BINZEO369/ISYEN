import { useState } from "react";
import { SENSOR_PINS } from "../services/config";
import { Modal } from "./Feedback";
import { Empty, same, ago } from "./resourceHelpers";
function Reading({ sensor, reading: r }) {
  const last = (value) =>
    Array.isArray(value) ? (value[value.length - 1] ?? null) : (value ?? null);
  const numeric = (field) => {
    const raw = last(r?.[field]);
    if (raw == null) return null;
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
  };
  if (!r)
    return (
      <div className="sensor-reading">
        <span className="reading-label">No readings available yet</span>
      </div>
    );

  const digital = {
    PIR: { field: "motion", active: "MOTION", inactive: "CLEAR", label: "Motion Status" },
    REED: { field: "door_state", active: "OPEN", inactive: "CLOSED", label: "Door / Window Status" },
    WATER_LEAK: { field: "leak_state", active: "LEAK DETECTED", inactive: "DRY", label: "Water Leak Status" },
    TOUCH: { field: "touch_state", active: "TOUCHED", inactive: "IDLE", label: "Touch Status" },
  }[sensor.sensor_type];
  if (digital) {
    const raw = numeric(digital.field);
    const active =
      raw == null
        ? null
        : raw === (sensor.pir_trigger_state === "LOW" ? 0 : 1);
    return (
      <div className="sensor-reading">
        <div>
          <div className="reading-value compact">
            {active == null ? "NO DATA" : active ? digital.active : digital.inactive}
          </div>
          <div className="reading-label">{digital.label}</div>
        </div>
        <div>
          <div className="reading-value compact">{ago(r.created_at)}</div>
          <div className="reading-label">Last updated</div>
        </div>
      </div>
    );
  }

  if (sensor.sensor_type === "LDR") {
    const raw = numeric("light_value");
    const status = raw == null ? "NO DATA" : raw > 3000 ? "BRIGHT" : raw > 1500 ? "DIM" : "DARK";
    return (
      <div className="sensor-reading">
        <div>
          <div className="reading-value compact">{status}</div>
          <div className="reading-label">Light Level</div>
        </div>
        <div>
          <div className="reading-value">{raw == null ? "—" : raw.toFixed(0)}</div>
          <div className="reading-label">Raw ADC</div>
        </div>
      </div>
    );
  }

  if (sensor.sensor_type === "RAIN") {
    const raw = numeric("rain_value");
    const status =
      raw == null ? "NO DATA" : raw > 3000 ? "HEAVY" : raw > 1500 ? "MODERATE" : raw > 500 ? "LIGHT" : "DRY";
    return (
      <div className="sensor-reading">
        <div>
          <div className="reading-value compact">{status}</div>
          <div className="reading-label">Rain Level</div>
        </div>
        <div>
          <div className="reading-value">{raw == null ? "—" : raw.toFixed(0)}</div>
          <div className="reading-label">Raw ADC</div>
        </div>
      </div>
    );
  }

  if (sensor.sensor_type.startsWith("MQ")) {
    const value = numeric("gas_value");
    return (
      <div className="sensor-reading">
        <div>
          <div className="reading-value">{value == null ? "—" : value.toFixed(0)}</div>
          <div className="reading-label">Gas Value</div>
        </div>
      </div>
    );
  }

  if (sensor.sensor_type.startsWith("DHT")) {
    const temperature = numeric("temperature");
    const humidity = numeric("humidity");
    return (
      <div className="sensor-reading">
        <div>
          <div className="reading-value">
            {temperature == null ? "—" : temperature.toFixed(1)}
            {temperature != null && <small className="reading-unit">°C</small>}
          </div>
          <div className="reading-label">Temperature</div>
        </div>
        <div>
          <div className="reading-value">
            {humidity == null ? "—" : humidity.toFixed(1)}
            {humidity != null && <small className="reading-unit">%</small>}
          </div>
          <div className="reading-label">Humidity</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sensor-reading">
      <span className="reading-label">No readings available yet</span>
    </div>
  );
}
export function SensorCards({ items, gateways, nodes, readings, onDelete }) {
  return (
    <div className="card-grid sensor-grid">
      <style jsx global>{`
.app-shell .sensor-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 255px), 1fr)); gap: 14px; }
.app-shell .sensor-card { min-width: 0; display: flex; flex-direction: column; gap: 10px; }
      `}</style>
      {items.length ? (
        items.map((s) => {
          const gw = gateways.find((g) => same(g.id, s.gateway_id));
          const node =
            s.node_id && Number(s.node_id) !== 0
              ? nodes.find((n) => same(n.id, s.node_id))?.node_name ||
                "Unknown Node"
              : "Main Board";
          const trigger = ["PIR", "REED", "WATER_LEAK", "TOUCH"].includes(
            s.sensor_type,
          );
          return (
            <article className={`card sensor-card`} key={s.id}>
              <div className="card-top">
                <div className="resource-heading">
                  <span className="resource-icon sensor-icon" aria-hidden="true">⌁</span>
                  <div className="resource-heading-copy">
                    <div className="card-title">{s.sensor_name}</div>
                    <div className="card-sub">
                      {gw?.gateway_name || "Gateway"} · {node}
                    </div>
                  </div>
                </div>
                <span className="status">{s.sensor_type}</span>
              </div>
              <div className="badge-row">
                <span className="badge">GPIO {s.pin}</span>
                {trigger && (
                  <span className="badge">
                    Trigger · {s.pir_trigger_state || "HIGH"}
                  </span>
                )}
              </div>
              <Reading sensor={s} reading={readings[s.id]} />
              <div className="card-actions">
                <span className="reading-label">
                  {trigger ? "Fast polling" : "Sensor reading"}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Delete ${s.sensor_name}`}
                  onClick={() => onDelete(s)}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })
      ) : (
        <Empty>No sensors added yet.</Empty>
      )}
    </div>
  );
}



const SENSOR_TYPES = ["DHT11", "DHT22", "MQ2", "MQ135", "PIR", "REED", "LDR", "RAIN", "WATER_LEAK", "TOUCH"];
const SUB_NODE_TYPES = new Set(["PIR", "REED", "LDR", "RAIN", "WATER_LEAK", "TOUCH"]);
const DIGITAL_TYPES = new Set(["PIR", "REED", "WATER_LEAK", "TOUCH"]);
export const createSensor = (request, payload) => request("/api/sensors", { method: "POST", body: JSON.stringify(payload) });
export const deleteSensor = (request, id) => request(`/api/sensors/${encodeURIComponent(id)}`, { method: "DELETE" });

export default function SensorsSection({ items, gateways, nodes, readings, request, onRefresh, notify }) {
  const [adding, setAdding] = useState(false); const [busy, setBusy] = useState(false);
  const [gatewayId, setGatewayId] = useState(""); const [nodeId, setNodeId] = useState("0");
  const [sensorType, setSensorType] = useState("DHT11"); const [trigger, setTrigger] = useState("HIGH");
  const subOnly = SUB_NODE_TYPES.has(sensorType); const digital = DIGITAL_TYPES.has(sensorType);
  const approved = nodes.filter((node) => node.is_approved && String(node.gateway_id) === String(gatewayId));
  const allowedNodes = subOnly ? approved : [{ id: "0", node_name: "Main ESP32 (Gateway)" }, ...approved];
  function openAdd() { if (!gateways.length) { notify("Add a gateway first.", true); return; } setGatewayId(String(gateways[0].id)); setNodeId("0"); setSensorType("DHT11"); setTrigger("HIGH"); setAdding(true); }
  async function remove(sensor) { if (!window.confirm("Delete this sensor?")) return; try { await deleteSensor(request, sensor.id); notify("Sensor deleted."); await onRefresh(); } catch (error) { notify(error.message, true); } }
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true); const form = new FormData(event.currentTarget); const pin = Number(form.get("pin")); const node = Number(form.get("node"));
    try {
      if (!SENSOR_PINS.includes(pin)) throw new Error("Select a valid GPIO pin.");
      if (subOnly && (!node || !approved.some((item) => String(item.id) === String(node)))) throw new Error(`${sensorType} can only be assigned to an approved Sub Node.`);
      await createSensor(request, { gateway_id: Number(form.get("gateway")), node_id: node, sensor_name: String(form.get("name")).trim(), pin, sensor_type: sensorType, pir_trigger_state: trigger });
      setAdding(false); notify("Sensor added."); await onRefresh();
    } catch (error) { notify(error.message, true); } finally { setBusy(false); }
  }
  return (<>
    <section className="dashboard-block">
      <div className="section-heading"><div><p className="eyebrow">Environmental Monitoring</p><h2>Sensors</h2></div><button className="btn btn-primary" onClick={openAdd}>＋ Add Sensor</button></div>
      <p className="muted page-description">View the latest temperature, humidity, gas, light, rain, leak, touch and contact readings from your connected sensors.</p>
      <SensorCards items={items} gateways={gateways} nodes={nodes} readings={readings} onDelete={remove} />
    </section>
    {adding && <Modal title="Add Sensor" eyebrow="Environmental Monitoring" onClose={() => setAdding(false)}><form onSubmit={submit}>
      <label htmlFor="sensor-name">Sensor name</label><input id="sensor-name" name="name" required maxLength={80} placeholder="e.g., Living room temperature" autoFocus />
      <label htmlFor="sensor-gateway">Gateway</label><select id="sensor-gateway" name="gateway" required value={gatewayId} onChange={(event) => { const next = event.target.value; setGatewayId(next); const first = nodes.find((item) => item.is_approved && String(item.gateway_id) === String(next)); setNodeId(subOnly ? String(first?.id || "") : "0"); }} >{gateways.map((item) => <option key={item.id} value={item.id}>{item.gateway_name}</option>)}</select>
      <label htmlFor="sensor-node">Node</label><select id="sensor-node" name="node" required value={nodeId} onChange={(event) => setNodeId(event.target.value)}>{subOnly && !approved.length && <option value="">Select an approved Sub Node</option>}{allowedNodes.map((item) => <option key={item.id} value={item.id}>{item.node_name || "Sub Node"}</option>)}</select>
      <label htmlFor="sensor-type">Sensor Type</label><select id="sensor-type" value={sensorType} onChange={(event) => { const next = event.target.value; setSensorType(next); const first = approved[0]; setNodeId(SUB_NODE_TYPES.has(next) ? String(first?.id || "") : "0"); }}>{SENSOR_TYPES.map((type) => <option key={type} value={type}>{type}{SUB_NODE_TYPES.has(type) ? " · Sub Node only" : type.startsWith("DHT") ? " · temperature and humidity" : type === "MQ2" ? " · gas" : " · air quality"}</option>)}</select>
      {digital && <div className="conditional"><label htmlFor="sensor-trigger">Trigger state</label><select id="sensor-trigger" value={trigger} onChange={(event) => setTrigger(event.target.value)}><option value="HIGH">HIGH — pin is HIGH when triggered</option><option value="LOW">LOW — pin is LOW when triggered</option></select><p className="hint">Choose the signal level that indicates an active sensor event.</p></div>}
      {subOnly && !approved.length && <p className="warning" role="alert">{sensorType} sensors require an approved Sub Node on this Gateway.</p>}
      <label htmlFor="sensor-pin">GPIO Pin</label><select id="sensor-pin" name="pin">{SENSOR_PINS.map((pin) => <option key={pin} value={pin}>GPIO {pin}</option>)}</select>
      <div className="modal-actions"><button className="btn btn-quiet" type="button" onClick={() => setAdding(false)}>Cancel</button><button className="btn btn-primary" type="submit" disabled={busy || (subOnly && !approved.length)}>{busy ? "Saving…" : "Add Sensor"}</button></div>
    </form></Modal>}
    <style jsx global>{`
      .app-shell .sensor-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 255px), 1fr)); gap: 14px; }
      .app-shell .sensor-card { min-width: 0; display: flex; flex-direction: column; gap: 10px; }
    `}</style>
  </>);
}
