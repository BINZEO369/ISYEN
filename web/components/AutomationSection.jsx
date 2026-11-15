"use client";

import { useState } from "react";
import { Modal } from "./Feedback";

const OPERATOR_LABELS = {
  eq: "equals",
  ne: "does not equal",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  changed: "has changed",
};
const ACTION_LABELS = { on: "Turn on", off: "Turn off", toggle: "Toggle" };
const DIGITAL_TYPES = new Set(["PIR", "REED", "WATER_LEAK", "TOUCH"]);
const OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "changed"];
const DIGITAL_OPERATORS = ["eq", "ne", "changed"];

function newForm(gatewayId = "") {
  return {
    id: null,
    automation_name: "",
    gateway_id: gatewayId,
    logic_type: "AND",
    cooldown_seconds: "30",
    conditions: [{ sensor_id: "", operator: "eq", value: "1" }],
    actions: [{ device_id: "", action_type: "on", delay_seconds: "0" }],
  };
}

function formatDate(value) {
  if (!value) return "Never triggered";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
}

function sensorTitle(sensor) {
  return sensor ? `${sensor.sensor_name} (${sensor.sensor_type})` : "Unknown sensor";
}

function actionTitle(action, devices) {
  const device = devices.find((item) => item.id === action.device_id);
  const delay = Number(action.delay_seconds) > 0 ? ` · after ${action.delay_seconds}s` : "";
  return `${device?.device_name || `Device #${action.device_id}`} · ${ACTION_LABELS[action.action_type] || action.action_type}${delay}`;
}

export default function AutomationSection({
  gateways,
  sensors,
  devices,
  automations,
  request,
  onRefresh,
  notify,
}) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [logView, setLogView] = useState(null);
  const [logRows, setLogRows] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  function openNew() {
    if (!gateways.length) {
      notify("Add a gateway before creating an automation.", true);
      return;
    }
    setForm(newForm(String(gateways[0].id)));
  }

  function openEdit(automation) {
    const conditions = [...(automation.automation_conditions || [])]
      .sort((a, b) => a.order_index - b.order_index)
      .map((condition) => ({
        sensor_id: String(condition.sensor_id),
        operator: condition.operator,
        value: condition.value == null ? "" : String(condition.value),
      }));
    const actions = [...(automation.automation_actions || [])]
      .sort((a, b) => a.order_index - b.order_index)
      .map((action) => ({
        device_id: String(action.device_id),
        action_type: action.action_type,
        delay_seconds: String(action.delay_seconds ?? 0),
      }));
    setForm({
      id: automation.id,
      automation_name: automation.automation_name,
      gateway_id: String(automation.gateway_id),
      logic_type: automation.logic_type,
      cooldown_seconds: String(automation.cooldown_seconds ?? 30),
      conditions: conditions.length
        ? conditions
        : [{ sensor_id: "", operator: "eq", value: "1" }],
      actions: actions.length
        ? actions
        : [{ device_id: "", action_type: "on", delay_seconds: "0" }],
    });
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateCondition(index, field, value) {
    setForm((current) => ({
      ...current,
      conditions: current.conditions.map((condition, itemIndex) => {
        if (itemIndex !== index) return condition;
        if (field === "sensor_id") {
          const sensor = sensors.find((item) => String(item.id) === value);
          const allowed = sensor && DIGITAL_TYPES.has(sensor.sensor_type)
            ? DIGITAL_OPERATORS
            : OPERATORS;
          return {
            ...condition,
            sensor_id: value,
            operator: allowed.includes(condition.operator) ? condition.operator : "eq",
          };
        }
        return { ...condition, [field]: value };
      }),
    }));
  }

  function updateAction(index, field, value) {
    setForm((current) => ({
      ...current,
      actions: current.actions.map((action, itemIndex) =>
        itemIndex === index ? { ...action, [field]: value } : action,
      ),
    }));
  }

  function addCondition() {
    if (form.conditions.length >= 3) {
      notify("An automation can have up to 3 conditions.", true);
      return;
    }
    setForm((current) => ({
      ...current,
      conditions: [...current.conditions, { sensor_id: "", operator: "eq", value: "1" }],
    }));
  }

  function removeCondition(index) {
    setForm((current) => ({
      ...current,
      conditions: current.conditions.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function addAction() {
    if (form.actions.length >= 3) {
      notify("An automation can have up to 3 actions.", true);
      return;
    }
    setForm((current) => ({
      ...current,
      actions: [...current.actions, { device_id: "", action_type: "on", delay_seconds: "0" }],
    }));
  }

  function removeAction(index) {
    setForm((current) => ({
      ...current,
      actions: current.actions.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const conditions = form.conditions.map((condition) => {
        const sensorId = Number(condition.sensor_id);
        const sensor = sensors.find((item) => item.id === sensorId);
        const value =
          condition.operator === "changed" || condition.value === ""
            ? null
            : Number(condition.value);
        if (!Number.isSafeInteger(sensorId) || sensorId < 1 || !sensor)
          throw new Error("Select a sensor for every condition.");
        if (condition.operator !== "changed" && !Number.isFinite(value))
          throw new Error("Enter a numeric value for every condition.");
        if (
          DIGITAL_TYPES.has(sensor.sensor_type) &&
          condition.operator !== "changed" &&
          ![0, 1].includes(value)
        )
          throw new Error("Digital sensor values must be 0 or 1.");
        return {
          sensor_id: sensorId,
          operator: condition.operator,
          value,
        };
      });
      const actions = form.actions.map((action) => {
        const deviceId = Number(action.device_id);
        const device = devices.find((item) => item.id === deviceId);
        const delay = Number(action.delay_seconds);
        if (!Number.isSafeInteger(deviceId) || deviceId < 1 || !device)
          throw new Error("Select a device for every action.");
        if (!Number.isInteger(delay) || delay < 0 || delay > 60)
          throw new Error("Action delays must be from 0 to 60 seconds.");
        return {
          device_id: deviceId,
          action_type: action.action_type,
          delay_seconds: delay,
        };
      });
      const payload = {
        gateway_id: Number(form.gateway_id),
        automation_name: form.automation_name.trim(),
        logic_type: form.logic_type,
        cooldown_seconds: Number(form.cooldown_seconds),
        conditions,
        actions,
      };
      if (!payload.automation_name) throw new Error("Enter an automation name.");
      if (!Number.isInteger(payload.cooldown_seconds) || payload.cooldown_seconds < 0 || payload.cooldown_seconds > 3600)
        throw new Error("Cooldown must be from 0 to 3600 seconds.");
      await request(
        form.id ? `/api/automations/${encodeURIComponent(form.id)}` : "/api/automations",
        { method: form.id ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      setForm(null);
      notify(form.id ? "Automation updated." : "Automation created.");
      await onRefresh();
    } catch (error) {
      notify(error.message || "Could not save this automation.", true);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(automation) {
    setWorkingId(automation.id);
    try {
      await request(`/api/automations/${encodeURIComponent(automation.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !automation.enabled }),
      });
      notify(automation.enabled ? "Automation disabled." : "Automation enabled.");
      await onRefresh();
    } catch (error) {
      notify(error.message || "Could not update this automation.", true);
    } finally {
      setWorkingId(null);
    }
  }

  async function remove(automation) {
    if (!window.confirm(`Delete “${automation.automation_name}” and its execution history?`)) return;
    setWorkingId(automation.id);
    try {
      await request(`/api/automations/${encodeURIComponent(automation.id)}`, { method: "DELETE" });
      notify("Automation and its logs deleted.");
      await onRefresh();
    } catch (error) {
      notify(error.message || "Could not delete this automation.", true);
    } finally {
      setWorkingId(null);
    }
  }

  async function openLogs(automation) {
    setLogView(automation);
    setLogRows([]);
    setLogsLoading(true);
    try {
      const result = await request(`/api/automations/${encodeURIComponent(automation.id)}/logs`);
      setLogRows(result?.logs || []);
    } catch (error) {
      notify(error.message || "Could not load execution logs.", true);
    } finally {
      setLogsLoading(false);
    }
  }

  const gatewaySensors = form
    ? sensors.filter((sensor) => String(sensor.gateway_id) === String(form.gateway_id))
    : [];
  const gatewayDevices = form
    ? devices.filter((device) => String(device.gateway_id) === String(form.gateway_id))
    : [];

  return (
    <section className="dashboard-block automation-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Rules &amp; Actions</p>
          <h2>Automations</h2>
        </div>
        <button className="btn btn-primary" type="button" onClick={openNew}>
          ＋ Add Automation
        </button>
      </div>
      <p className="muted page-description">
        Create sensor-driven IF/THEN rules for devices on the same gateway. Enabled rules are read by your ESP32 firmware; execution history appears here when the firmware reports it.
      </p>

      {automations.length ? (
        <div className="automation-grid">
          {automations.map((automation) => {
            const gateway = gateways.find((item) => item.id === automation.gateway_id);
            const conditions = [...(automation.automation_conditions || [])].sort(
              (a, b) => a.order_index - b.order_index,
            );
            const actions = [...(automation.automation_actions || [])].sort(
              (a, b) => a.order_index - b.order_index,
            );
            return (
              <article className="card automation-card" key={automation.id}>
                <div className="automation-card-heading">
                  <div className="resource-heading">
                    <span className="resource-icon automation-icon" aria-hidden="true">↗</span>
                    <div className="resource-heading-copy">
                      <h3 className="card-title">{automation.automation_name}</h3>
                      <p className="card-sub">{gateway?.gateway_name || "Gateway"}</p>
                    </div>
                  </div>
                  <span className={`automation-status ${automation.enabled ? "is-active" : "is-paused"}`}>
                    {automation.enabled ? "Active" : "Paused"}
                  </span>
                </div>

                <div className="automation-badges">
                  <span className="badge">{automation.logic_type}</span>
                  <span className="badge">Cooldown · {automation.cooldown_seconds}s</span>
                  <span className="badge">Fired · {automation.trigger_count || 0}</span>
                </div>

                <div className="automation-rule-box">
                  <div className="automation-rule-label">IF · {automation.logic_type}</div>
                  {conditions.length ? conditions.map((condition) => {
                    const sensor = sensors.find((item) => item.id === condition.sensor_id);
                    const value = condition.value == null ? "" : ` ${condition.value}`;
                    return (
                      <p className="automation-rule-line" key={condition.id || `${condition.sensor_id}-${condition.order_index}`}>
                        <span>{sensorTitle(sensor)}</span>
                        <strong>{OPERATOR_LABELS[condition.operator] || condition.operator}{value}</strong>
                      </p>
                    );
                  }) : <p className="automation-rule-empty">No conditions configured.</p>}
                  <div className="automation-rule-label automation-then-label">THEN</div>
                  {actions.length ? actions.map((action) => (
                    <p className="automation-rule-line" key={action.id || `${action.device_id}-${action.order_index}`}>
                      <span>{actionTitle(action, devices)}</span>
                    </p>
                  )) : <p className="automation-rule-empty">No actions configured.</p>}
                </div>

                <div className="automation-last-run">
                  <span>Last run</span>
                  <strong>{formatDate(automation.last_triggered_at)}</strong>
                </div>
                <div className="automation-actions">
                  <button
                    className={`toggle ${automation.enabled ? "on" : ""}`}
                    type="button"
                    aria-label={`${automation.enabled ? "Disable" : "Enable"} ${automation.automation_name}`}
                    aria-pressed={Boolean(automation.enabled)}
                    disabled={workingId === automation.id}
                    onClick={() => void toggle(automation)}
                  />
                  <div className="automation-action-buttons">
                    <button className="icon-button" type="button" onClick={() => void openLogs(automation)}>Logs</button>
                    <button className="icon-button" type="button" onClick={() => openEdit(automation)}>Edit</button>
                    <button className="icon-button" type="button" disabled={workingId === automation.id} onClick={() => void remove(automation)}>Delete</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state automation-empty">
          <div>
            <strong>No automations yet</strong>
            <p>Create an IF/THEN rule to connect a sensor condition to a device action.</p>
          </div>
        </div>
      )}

      {form && (
        <Modal
          title={form.id ? "Edit Automation" : "Add Automation"}
          eyebrow="Rule Builder"
          description="Choose sensors and devices on the same gateway. Each rule supports up to three conditions and actions."
          className="automation-modal"
          onClose={() => !saving && setForm(null)}
        >
          <form className="automation-editor" onSubmit={(event) => void save(event)}>
            <label htmlFor="automation-name">Automation name</label>
            <input
              id="automation-name"
              value={form.automation_name}
              onChange={(event) => updateForm("automation_name", event.target.value)}
              maxLength={80}
              required
              autoFocus
              placeholder="e.g. Motion light"
            />

            <label htmlFor="automation-gateway">Gateway</label>
            <select
              id="automation-gateway"
              value={form.gateway_id}
              disabled={Boolean(form.id)}
              onChange={(event) => updateForm("gateway_id", event.target.value)}
              required
            >
              {gateways.map((gateway) => (
                <option key={gateway.id} value={gateway.id}>{gateway.gateway_name}</option>
              ))}
            </select>

            <div className="automation-form-pair">
              <div>
                <label htmlFor="automation-logic">Logic</label>
                <select id="automation-logic" value={form.logic_type} onChange={(event) => updateForm("logic_type", event.target.value)}>
                  <option value="AND">AND · all conditions</option>
                  <option value="OR">OR · any condition</option>
                </select>
              </div>
              <div>
                <label htmlFor="automation-cooldown">Cooldown (seconds)</label>
                <input id="automation-cooldown" type="number" min="0" max="3600" step="1" value={form.cooldown_seconds} onChange={(event) => updateForm("cooldown_seconds", event.target.value)} required />
              </div>
            </div>

            <div className="automation-editor-section">
              <div className="automation-editor-heading">
                <div><span className="automation-step">IF</span><strong>Conditions</strong></div>
                <button className="automation-add-button" type="button" onClick={addCondition} disabled={form.conditions.length >= 3}>＋ Condition</button>
              </div>
              {form.conditions.map((condition, index) => {
                const selectedSensor = gatewaySensors.find((sensor) => String(sensor.id) === String(condition.sensor_id));
                const allowedOperators = selectedSensor && DIGITAL_TYPES.has(selectedSensor.sensor_type)
                  ? DIGITAL_OPERATORS
                  : OPERATORS;
                return (
                  <div className="automation-editor-row" key={`condition-${index}`}>
                    <div className="automation-row-fields">
                      <div>
                        <label className="sr-only" htmlFor={`condition-sensor-${index}`}>Condition sensor</label>
                        <select id={`condition-sensor-${index}`} value={condition.sensor_id} onChange={(event) => updateCondition(index, "sensor_id", event.target.value)} required>
                          <option value="">Select sensor</option>
                          {gatewaySensors.map((sensor) => <option key={sensor.id} value={sensor.id}>{sensorTitle(sensor)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="sr-only" htmlFor={`condition-operator-${index}`}>Condition operator</label>
                        <select id={`condition-operator-${index}`} value={condition.operator} onChange={(event) => updateCondition(index, "operator", event.target.value)}>
                          {allowedOperators.map((operator) => <option key={operator} value={operator}>{OPERATOR_LABELS[operator]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="sr-only" htmlFor={`condition-value-${index}`}>Condition value</label>
                        <input
                          id={`condition-value-${index}`}
                          type="number"
                          step={selectedSensor && DIGITAL_TYPES.has(selectedSensor.sensor_type) ? "1" : "any"}
                          min={selectedSensor && DIGITAL_TYPES.has(selectedSensor.sensor_type) ? "0" : undefined}
                          max={selectedSensor && DIGITAL_TYPES.has(selectedSensor.sensor_type) ? "1" : undefined}
                          value={condition.value}
                          disabled={condition.operator === "changed"}
                          required={condition.operator !== "changed"}
                          onChange={(event) => updateCondition(index, "value", event.target.value)}
                          placeholder="Value"
                        />
                      </div>
                    </div>
                    <button className="automation-remove-button" type="button" aria-label={`Remove condition ${index + 1}`} onClick={() => removeCondition(index)} disabled={form.conditions.length === 1}>×</button>
                  </div>
                );
              })}
            </div>

            <div className="automation-editor-section">
              <div className="automation-editor-heading">
                <div><span className="automation-step then-step">THEN</span><strong>Actions</strong></div>
                <button className="automation-add-button" type="button" onClick={addAction} disabled={form.actions.length >= 3}>＋ Action</button>
              </div>
              {form.actions.map((action, index) => (
                <div className="automation-editor-row" key={`action-${index}`}>
                  <div className="automation-row-fields action-fields">
                    <div>
                      <label className="sr-only" htmlFor={`action-device-${index}`}>Action device</label>
                      <select id={`action-device-${index}`} value={action.device_id} onChange={(event) => updateAction(index, "device_id", event.target.value)} required>
                        <option value="">Select device</option>
                        {gatewayDevices.map((device) => <option key={device.id} value={device.id}>{device.device_name} · GPIO {device.pin}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="sr-only" htmlFor={`action-type-${index}`}>Device action</label>
                      <select id={`action-type-${index}`} value={action.action_type} onChange={(event) => updateAction(index, "action_type", event.target.value)}>
                        {Object.entries(ACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="sr-only" htmlFor={`action-delay-${index}`}>Delay seconds</label>
                      <input id={`action-delay-${index}`} type="number" min="0" max="60" step="1" value={action.delay_seconds} onChange={(event) => updateAction(index, "delay_seconds", event.target.value)} placeholder="Delay (s)" required />
                    </div>
                  </div>
                  <button className="automation-remove-button" type="button" aria-label={`Remove action ${index + 1}`} onClick={() => removeAction(index)} disabled={form.actions.length === 1}>×</button>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn btn-quiet" type="button" disabled={saving} onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary" type="submit" disabled={saving || !gateways.length}>
                {saving ? "Saving…" : form.id ? "Save Changes" : "Create Automation"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {logView && (
        <Modal
          title={`${logView.automation_name} · Execution Logs`}
          eyebrow="Automation History"
          className="automation-log-modal"
          onClose={() => setLogView(null)}
        >
          {logsLoading ? (
            <div className="loading-state"><span className="spinner" />Loading executions…</div>
          ) : logRows.length ? (
            <div className="automation-log-list">
              {logRows.map((log) => (
                <article className="automation-log-item" key={log.id}>
                  <div className="automation-log-heading">
                    <strong className={log.success ? "log-success" : "log-failure"}>{log.success ? "Success" : "Failed"}</strong>
                    <time dateTime={log.triggered_at}>{formatDate(log.triggered_at)}</time>
                  </div>
                  <div className="automation-log-data">
                    <span>Sensor snapshot</span>
                    <pre>{JSON.stringify(log.trigger_snapshot ?? {}, null, 2)}</pre>
                  </div>
                  <div className="automation-log-data">
                    <span>Actions taken</span>
                    <pre>{JSON.stringify(log.actions_taken ?? {}, null, 2)}</pre>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">No executions have been reported yet.</div>
          )}
        </Modal>
      )}
    </section>
  );
}
