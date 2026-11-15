import styles from "./nodes.module.css";
import { Empty, same } from "../shared/resourceHelpers";
export function NodeCards({
  items,
  gateways,
  pending = false,
  onApprove,
  onDelete,
}) {
  const list = items.filter((n) => !n.is_approved === pending);
  return (
    <div className={`card-grid node-grid ${styles.grid}`}>
      {list.length ? (
        list.map((n) => {
          const gw = gateways.find((g) => same(g.id, n.gateway_id));
          return (
            <article className={`card node-card ${pending ? "pending" : ""} ${styles.card}`} key={n.id}>
              <div className="card-top">
                <div className="resource-heading">
                  <span className="resource-icon node-icon" aria-hidden="true">⌂</span>
                  <div className="resource-heading-copy">
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
