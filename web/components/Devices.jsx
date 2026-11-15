import { useState } from "react";
import { Modal } from "./Feedback";
import { Empty, same } from "./resourceHelpers";
export function DeviceCards({ items, gateways, nodes, onToggle, onDelete }) {
  return (
    <div className="card-grid device-grid">
      <style jsx global>{`
.app-shell .device-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 255px), 1fr)); gap: 14px; }
.app-shell .device-card { min-width: 0; min-height: 148px; }
      `}</style>
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
            <article className={`card device-card`} key={d.id}>
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



export const createDevice = (request, payload) => request("/api/devices", { method: "POST", body: JSON.stringify(payload) });
export const setDeviceState = (request, id) => request(`/api/devices/${encodeURIComponent(id)}/state`, { method: "PATCH", body: JSON.stringify({ action: "toggle" }) });
export const deleteDevice = (request, id) => request(`/api/devices/${encodeURIComponent(id)}`, { method: "DELETE" });

export default function DevicesSection({ items, gateways, nodes, options, request, onRefresh, notify }) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gatewayId, setGatewayId] = useState("");
  function openAdd() { if (!gateways.length) { notify("Add a gateway first.", true); return; } setGatewayId(String(gateways[0].id)); setAdding(true); }
  async function toggle(device) {
    try { await setDeviceState(request, device.id); await onRefresh(); }
    catch (error) { notify(error.message, true); await onRefresh(); }
  }
  async function remove(device) {
    if (!window.confirm("Delete this device?")) return;
    try { await deleteDevice(request, device.id); notify("Device deleted."); await onRefresh(); }
    catch (error) { notify(error.message, true); }
  }
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true);
    const form = new FormData(event.currentTarget); const pin = Number(form.get("pin"));
    try {
      await createDevice(request, { gateway_id: Number(form.get("gateway")), node_id: Number(form.get("node")), device_name: String(form.get("name")).trim(), pin });
      setAdding(false); notify("Device added."); await onRefresh();
    } catch (error) { notify(error.message, true); } finally { setBusy(false); }
  }
  const approved = nodes.filter((node) => node.is_approved && String(node.gateway_id) === String(gatewayId));
  return (<>
    <section className="dashboard-block">
      <div className="section-heading"><div><p className="eyebrow">GPIO Controls</p><h2>Devices</h2></div><button className="btn btn-primary" onClick={openAdd}>＋ Add Device</button></div>
      <p className="muted page-description">Add any GPIO-connected device and choose its pin number.</p>
      <DeviceCards items={items} gateways={gateways} nodes={nodes} onToggle={toggle} onDelete={remove} />
    </section>
    {adding && <Modal title="Add Device" eyebrow="Device Setup" onClose={() => setAdding(false)}><form onSubmit={submit}>
      <label htmlFor="device-name">Device name</label><input id="device-name" name="name" required maxLength={80} placeholder="e.g., Living room fan" autoFocus />
      <label htmlFor="device-gateway">Gateway</label><select id="device-gateway" name="gateway" required value={gatewayId} onChange={(event) => setGatewayId(event.target.value)}>{gateways.map((item) => <option key={item.id} value={item.id}>{item.gateway_name}</option>)}</select>
      <label htmlFor="device-node">Node</label><select id="device-node" name="node" required><option value="0">Main ESP32 (Gateway)</option>{approved.map((item) => <option key={item.id} value={item.id}>{item.node_name || "Sub Node"}</option>)}</select>
      <label htmlFor="device-pin">GPIO Pin</label><select id="device-pin" name="pin">{options.device_pins.map((pin) => <option key={pin} value={pin}>GPIO {pin}</option>)}</select>
      <div className="modal-actions"><button className="btn btn-quiet" type="button" onClick={() => setAdding(false)}>Cancel</button><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Add Device"}</button></div>
    </form></Modal>}
    <style jsx global>{`
      .app-shell .device-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 255px), 1fr)); gap: 14px; }
      .app-shell .device-card { min-width: 0; min-height: 148px; }
    `}</style>
  </>);
}
