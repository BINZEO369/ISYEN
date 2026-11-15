import styles from "./sensors.module.css";
import { Empty, same, ago } from "../shared/resourceHelpers";
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
    <div className={`card-grid sensor-grid ${styles.grid}`}>
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
            <article className={`card sensor-card ${styles.card}`} key={s.id}>
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
