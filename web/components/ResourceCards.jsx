import { useState } from "react";

const same = (a, b) => String(a) === String(b);
const ago = (value) => {
  if (!value) return "—";
  const n = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  return n < 60
    ? `${n}s ago`
    : n < 3600
      ? `${Math.floor(n / 60)}m ago`
      : n < 86400
        ? `${Math.floor(n / 3600)}h ago`
        : `${Math.floor(n / 86400)}d ago`;
};
const Empty = ({ children }) => <div className="empty-state">{children}</div>;
export function GatewayCards({ items }) {
  return (
    <div className="card-grid">
      {items.length ? (
        items.map((g) => {
          const online =
            !!g.last_seen &&
            Date.now() - new Date(g.last_seen).getTime() < 90000;
          return (
            <article className="card" key={g.id}>
              <div className="card-top">
                <div>
                  <div className="card-title">{g.gateway_name}</div>
                  <div className="card-sub">
                    MAC · {g.mac_address || "Waiting for connection"}
                  </div>
                </div>
                {g.mac_address ? (
                  <span className={`status ${online ? "" : "offline"}`}>
                    ● {online ? "Online" : "Offline"}
                  </span>
                ) : (
                  <span className="badge code">
                    Claim Code · {g.claim_code || "—"}
                  </span>
                )}
              </div>
              <div className="badge-row">
                {g.last_seen && (
                  <span className="badge">Last seen · {ago(g.last_seen)}</span>
                )}
              </div>
            </article>
          );
        })
      ) : (
        <Empty>
          No gateways added yet. Add a gateway to get started.
        </Empty>
      )}
    </div>
  );
}
export function NodeCards({
  items,
  gateways,
  pending = false,
  onApprove,
  onDelete,
}) {
  const list = items.filter((n) => !n.is_approved === pending);
  return (
    <div className="card-grid">
      {list.length ? (
        list.map((n) => {
          const gw = gateways.find((g) => same(g.id, n.gateway_id));
          return (
            <article className={`card ${pending ? "pending" : ""}`} key={n.id}>
              <div className="card-top">
                <div>
                  <div className="card-title">
                    {pending
                      ? "New Node detected"
                      : n.node_name || "Sub Node"}
                  </div>
                  <div className="card-sub">
                    {pending ? "" : `${gw?.gateway_name || "Gateway"} · `}MAC ·{" "}
                    {n.mac_address}
                  </div>
                </div>
                <span className={`status ${pending ? "offline" : ""}`}>
                  {pending ? "Approval required" : "Approved"}
                </span>
              </div>
              <div className="card-actions">
                {pending ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => onApprove(n)}
                  >
                    Approve and name
                  </button>
                ) : (
                  <>
                    <span className="badge">
                      Sub Node · {gw?.gateway_name || "Gateway"}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={`Delete ${n.node_name || "Node"}`}
                      onClick={() => onDelete(n)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })
      ) : (
        <Empty>
          {pending
            ? "There are no pending Sub Nodes."
            : "No Sub Nodes have been approved yet."}
        </Empty>
      )}
    </div>
  );
}
export function DeviceCards({ items, gateways, nodes, onToggle, onDelete }) {
  return (
    <div className="card-grid">
      {items.length ? (
        items.map((d) => {
          const on = Array.isArray(d.device_states)
            ? Boolean(d.device_states[0]?.is_on)
            : Boolean(d.device_states?.is_on);
          const gw = gateways.find((g) => same(g.id, d.gateway_id));
          const node =
            d.node_id && Number(d.node_id) !== 0
              ? nodes.find((n) => same(n.id, d.node_id))?.node_name ||
                "Unknown Node"
              : "Main Board";
          return (
            <article className="card" key={d.id}>
              <div className="card-top">
                <div>
                  <div className="card-title">{d.device_name}</div>
                  <div className="card-sub">
                    {gw?.gateway_name || "Gateway"} · {node}
                  </div>
                </div>
                <span className={`status ${on ? "" : "offline"}`}>
                  {on ? "ON" : "OFF"}
                </span>
              </div>
              <div className="badge-row">
                <span className="badge">GPIO {d.pin}</span>
              </div>
              <div className="card-actions">
                <button
                  className={`toggle ${on ? "on" : ""}`}
                  role="switch"
                  aria-checked={on}
                  aria-label={`Toggle ${d.device_name}`}
                  onClick={() => onToggle(d)}
                />
                <button
                  className="icon-button"
                  aria-label={`Delete ${d.device_name}`}
                  onClick={() => onDelete(d)}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })
      ) : (
        <Empty>No devices added yet.</Empty>
      )}
    </div>
  );
}
function Reading({ sensor, reading: r }) {
  const last = (v) =>
    Array.isArray(v) ? (v[v.length - 1] ?? null) : (v ?? null);
  if (!r)
    return (
      <div className="sensor-reading">
        <span className="reading-label">No readings available yet</span>
      </div>
    );
  if (["PIR", "REED"].includes(sensor.sensor_type)) {
    const raw = last(sensor.sensor_type === "PIR" ? r.motion : r.door_state),
      active = raw == null ? null : Number(raw) === 1;
    const label =
      active == null
        ? "NO DATA"
        : sensor.sensor_type === "PIR"
          ? active
            ? "MOTION"
            : "CLEAR"
          : active
            ? "OPEN"
            : "CLOSED";
    return (
      <div className="sensor-reading">
        <div>
          <div className="reading-value compact">{label}</div>
          <div className="reading-label">
            {sensor.sensor_type === "PIR"
              ? "Motion Status"
              : "Door / Window Status"}
          </div>
        </div>
        <div>
          <div className="reading-value compact">{ago(r.created_at)}</div>
          <div className="reading-label">Last updated</div>
        </div>
      </div>
    );
  }
  if (sensor.sensor_type.startsWith("MQ")) {
    const v = last(r.gas_value);
    return (
      <div className="sensor-reading">
        <div>
          <div className="reading-value">
            {v == null ? "—" : Number(v).toFixed(0)}
          </div>
          <div className="reading-label">Gas Value</div>
        </div>
      </div>
    );
  }
  const t = last(r.temperature),
    h = last(r.humidity);
  return (
    <div className="sensor-reading">
      <div>
        <div className="reading-value">
          {t == null ? "—" : Number(t).toFixed(1)}°C
        </div>
        <div className="reading-label">Temperature</div>
      </div>
      <div>
        <div className="reading-value">
          {h == null ? "—" : Number(h).toFixed(1)}%
        </div>
        <div className="reading-label">Humidity</div>
      </div>
    </div>
  );
}
export function SensorCards({ items, gateways, nodes, readings, onDelete }) {
  return (
    <div className="card-grid">
      {items.length ? (
        items.map((s) => {
          const gw = gateways.find((g) => same(g.id, s.gateway_id));
          const node =
            s.node_id && Number(s.node_id) !== 0
              ? nodes.find((n) => same(n.id, s.node_id))?.node_name ||
                "Unknown Node"
              : "Main Board";
          const trigger = ["PIR", "REED"].includes(s.sensor_type);
          return (
            <article className="card" key={s.id}>
              <div className="card-top">
                <div>
                  <div className="card-title">{s.sensor_name}</div>
                  <div className="card-sub">
                    {gw?.gateway_name || "Gateway"} · {node}
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
