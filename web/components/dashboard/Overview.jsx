import { useState } from "react";
import { Modal } from "../Feedback";
import { Empty, same, ago } from "./shared/resourceHelpers";
export function GatewayCards({ items }) {
  return (
    <div className="card-grid gateway-grid">
      <style jsx global>{`
.app-shell .gateway-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 255px), 1fr)); gap: 14px; }
.app-shell .gateway-card { min-width: 0; }
      `}</style>
      {items.length ? (
        items.map((g) => {
          const online =
            !!g.last_seen &&
            Date.now() - new Date(g.last_seen).getTime() < 90000;
          return (
            <article className={`card gateway-card`} key={g.id}>
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

export function NodeCards({
  items,
  gateways,
  pending = false,
  onApprove,
  onDelete,
}) {
  const list = items.filter((n) => !n.is_approved === pending);
  return (
    <div className="card-grid node-grid">
      <style jsx global>{`
.app-shell .node-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 255px), 1fr)); gap: 14px; }
.app-shell .node-card { min-width: 0; }
      `}</style>
      {list.length ? (
        list.map((n) => {
          const gw = gateways.find((g) => same(g.id, n.gateway_id));
          return (
            <article className={`card node-card ${pending ? "pending" : ""}`} key={n.id}>
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



export const createGateway = (request, payload) => request("/api/gateways", { method: "POST", body: JSON.stringify(payload) });
export const approveNode = (request, id, name) => request(`/api/nodes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ node_name: name, is_approved: true }) });
export const deleteNode = (request, id) => request(`/api/nodes/${encodeURIComponent(id)}`, { method: "DELETE" });

export default function OverviewSection({ gateways, nodes, devices, sensors, request, onRefresh, notify }) {
  const [adding, setAdding] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); if (busy) return; setBusy(true); const form = new FormData(event.currentTarget); try { const result = await createGateway(request, { gateway_name: String(form.get("name")).trim() }); setAdding(false); notify(`Gateway created${result?.claim_code ? ` · Claim Code ${result.claim_code}` : ""}`); await onRefresh(); } catch (error) { notify(error.message, true); } finally { setBusy(false); } }
  async function approve(node) { const name = window.prompt("Enter a name for this Node:", "Room Node"); if (!name?.trim()) return; try { await approveNode(request, node.id, name.trim()); notify("Node approved."); await onRefresh(); } catch (error) { notify(error.message, true); } }
  async function removeNode(node) { const deviceCount = devices.filter((item) => String(item.node_id) === String(node.id)).length; const sensorCount = sensors.filter((item) => String(item.node_id) === String(node.id)).length; if (!window.confirm(`Delete “${node.node_name || "Node"}”? This will also delete ${deviceCount} device${deviceCount === 1 ? "" : "s"} and ${sensorCount} sensor${sensorCount === 1 ? "" : "s"}.`)) return; try { await deleteNode(request, node.id); notify("Node and related resources deleted."); await onRefresh(); } catch (error) { notify(error.message, true); } }
  return (<>
    <section className="dashboard-block"><div className="section-heading"><div><p className="eyebrow">Connection Management</p><h2>Your Gateways</h2></div><button className="btn btn-primary" onClick={() => setAdding(true)}>＋ Add Gateway</button></div><GatewayCards items={gateways} /></section>
    <section className="dashboard-block"><div className="section-heading"><div><p className="eyebrow">Awaiting Approval</p><h2>Pending Sub Nodes</h2></div></div><NodeCards items={nodes} gateways={gateways} pending onApprove={approve} /></section>
    <section className="dashboard-block"><div className="section-heading"><div><p className="eyebrow">Approved Connections</p><h2>Sub Nodes</h2></div></div><NodeCards items={nodes} gateways={gateways} onDelete={removeNode} /></section>
    {adding && <Modal title="Add Gateway" eyebrow="New Connection" description="A claim code will be generated for your ESP32." onClose={() => setAdding(false)}><form onSubmit={submit}><label htmlFor="gateway-name">Gateway name</label><input id="gateway-name" name="name" required maxLength={80} placeholder="e.g., Home Gateway" autoFocus /><div className="modal-actions"><button className="btn btn-quiet" type="button" onClick={() => setAdding(false)}>Cancel</button><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Generate Claim Code"}</button></div></form></Modal>}
    <style jsx global>{`
      .app-shell .gateway-grid,.app-shell .node-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 255px), 1fr)); gap: 14px; }
      .app-shell .gateway-card,.app-shell .node-card { min-width: 0; }
    `}</style>
  </>);
}
