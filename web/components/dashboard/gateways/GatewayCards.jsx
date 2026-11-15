import styles from "./gateways.module.css";
import { Empty, same, ago } from "../shared/resourceHelpers";
export function GatewayCards({ items }) {
  return (
    <div className={`card-grid gateway-grid ${styles.grid}`}>
      {items.length ? (
        items.map((g) => {
          const online =
            !!g.last_seen &&
            Date.now() - new Date(g.last_seen).getTime() < 90000;
          return (
            <article className={`card gateway-card ${styles.card}`} key={g.id}>
              <div className="card-top">
                <div className="resource-heading">
                  <span className="resource-icon gateway-icon" aria-hidden="true">⌘</span>
                  <div className="resource-heading-copy">
                    <div className="card-title">{g.gateway_name}</div>
                    <div className="card-sub">
                      MAC · {g.mac_address || "Waiting for connection"}
                    </div>
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
