import styles from "./devices.module.css";
import { Empty, same } from "../shared/resourceHelpers";
export function DeviceCards({ items, gateways, nodes, onToggle, onDelete }) {
  return (
    <div className={`card-grid device-grid ${styles.grid}`}>
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
            <article className={`card device-card ${styles.card}`} key={d.id}>
              <div className="card-top">
                <div className="resource-heading">
                  <span className="resource-icon device-icon" aria-hidden="true">◈</span>
                  <div className="resource-heading-copy">
                    <div className="card-title">{d.device_name}</div>
                    <div className="card-sub">
                      {gw?.gateway_name || "Gateway"} · {node}
                    </div>
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
