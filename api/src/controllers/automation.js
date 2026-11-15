"use strict";

const { HttpError } = require("../errors");
const { supabaseRequest, query } = require("../supabase");
const { readBody } = require("../http");
const { requireId, requireKeys, requireText } = require("../validators");

const MAX_RULE_ITEMS = 3;
const MAX_DATABASE_ID = 2147483647;
const OPERATORS = new Set(["eq", "ne", "gt", "gte", "lt", "lte", "changed"]);
const DIGITAL_SENSOR_TYPES = new Set(["PIR", "REED", "WATER_LEAK", "TOUCH"]);
const ACTIONS = new Set(["on", "off", "toggle"]);

function databaseId(value, field) {
  const id = requireId(value, field);
  if (id > MAX_DATABASE_ID)
    throw new HttpError(400, `Please provide a valid ${field}.`);
  return id;
}

function boundedInteger(value, field, minimum, maximum) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  )
    throw new HttpError(
      400,
      `${field} must be an integer from ${minimum} to ${maximum}.`,
    );
  return value;
}

function parseConditions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_RULE_ITEMS)
    throw new HttpError(400, "Add between 1 and 3 automation conditions.");
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new HttpError(400, "An automation condition is invalid.");
    requireKeys(item, ["sensor_id", "operator", "value"]);
    const sensor_id = databaseId(item.sensor_id, "sensor ID");
    if (typeof item.operator !== "string" || !OPERATORS.has(item.operator))
      throw new HttpError(400, "Select a supported condition operator.");
    let conditionValue = null;
    if (item.value !== undefined && item.value !== null) {
      if (typeof item.value !== "number" || !Number.isFinite(item.value))
        throw new HttpError(400, "Condition values must be finite numbers.");
      conditionValue = item.value;
    }
    if (item.operator !== "changed" && conditionValue === null)
      throw new HttpError(400, "Enter a value for this condition.");
    return { sensor_id, operator: item.operator, value: conditionValue };
  });
}

function parseActions(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_RULE_ITEMS)
    throw new HttpError(400, "Add between 1 and 3 automation actions.");
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new HttpError(400, "An automation action is invalid.");
    requireKeys(item, ["device_id", "action_type", "delay_seconds"]);
    const device_id = databaseId(item.device_id, "device ID");
    if (typeof item.action_type !== "string" || !ACTIONS.has(item.action_type))
      throw new HttpError(400, "Select a supported device action.");
    const delay_seconds =
      item.delay_seconds === undefined
        ? 0
        : boundedInteger(item.delay_seconds, "Action delay", 0, 60);
    return { device_id, action_type: item.action_type, delay_seconds };
  });
}

function parseRule(body) {
  const keys = [
    "gateway_id",
    "automation_name",
    "logic_type",
    "cooldown_seconds",
    "conditions",
    "actions",
  ];
  requireKeys(body, keys);
  for (const key of keys) {
    if (!Object.hasOwn(body, key))
      throw new HttpError(400, `The ${key} field is required.`);
  }
  const gateway_id = databaseId(body.gateway_id, "gateway ID");
  const automation_name = requireText(body.automation_name, "Automation name");
  if (!new Set(["AND", "OR"]).has(body.logic_type))
    throw new HttpError(400, "Logic type must be AND or OR.");
  const cooldown_seconds = boundedInteger(
    body.cooldown_seconds,
    "Cooldown",
    0,
    3600,
  );
  return {
    gateway_id,
    automation_name,
    logic_type: body.logic_type,
    cooldown_seconds,
    conditions: parseConditions(body.conditions),
    actions: parseActions(body.actions),
  };
}

async function verifyOwnerResources(config, token, rule) {
  const gateways = await supabaseRequest(
    config,
    token,
    query("gateways", {
      id: `eq.${rule.gateway_id}`,
      select: "id",
      limit: "1",
    }),
  );
  if (!Array.isArray(gateways) || !gateways.length)
    throw new HttpError(404, "Gateway not found.");

  const sensorIds = [...new Set(rule.conditions.map((condition) => condition.sensor_id))];
  const deviceIds = [...new Set(rule.actions.map((action) => action.device_id))];
  const [sensors, devices] = await Promise.all([
    supabaseRequest(
      config,
      token,
      query("sensors", {
        id: `in.(${sensorIds.join(",")})`,
        gateway_id: `eq.${rule.gateway_id}`,
        select: "id,sensor_type",
        limit: String(sensorIds.length),
      }),
    ),
    supabaseRequest(
      config,
      token,
      query("devices", {
        id: `in.(${deviceIds.join(",")})`,
        gateway_id: `eq.${rule.gateway_id}`,
        select: "id",
        limit: String(deviceIds.length),
      }),
    ),
  ]);
  if (!Array.isArray(sensors) || sensors.length !== sensorIds.length)
    throw new HttpError(400, "Select sensors belonging to the selected gateway.");
  if (!Array.isArray(devices) || devices.length !== deviceIds.length)
    throw new HttpError(400, "Select devices belonging to the selected gateway.");

  const sensorTypes = new Map(sensors.map((sensor) => [sensor.id, sensor.sensor_type]));
  for (const condition of rule.conditions) {
    if (!DIGITAL_SENSOR_TYPES.has(sensorTypes.get(condition.sensor_id))) continue;
    if (!["eq", "ne", "changed"].includes(condition.operator))
      throw new HttpError(400, "Digital sensors support equals, not-equals, or changed conditions.");
    if (condition.operator !== "changed" && ![0, 1].includes(condition.value))
      throw new HttpError(400, "Digital sensor conditions must use 0 or 1.");
  }
}

async function save(req, config, token, rawId = null) {
  const body = await readBody(req);
  let automationId = null;
  if (rawId !== null) {
    automationId = databaseId(rawId, "automation ID");
    if (Object.keys(body).length === 1 && Object.hasOwn(body, "enabled")) {
      if (typeof body.enabled !== "boolean")
        throw new HttpError(400, "enabled must be a boolean.");
      const updated = await supabaseRequest(
        config,
        token,
        query("automations", {
          id: `eq.${automationId}`,
          select: "id,enabled",
        }),
        {
          method: "PATCH",
          prefer: "return=representation",
          body: { enabled: body.enabled },
        },
      );
      if (!Array.isArray(updated) || !updated.length)
        throw new HttpError(404, "Automation not found.");
      return updated[0];
    }

    const current = await supabaseRequest(
      config,
      token,
      query("automations", {
        id: `eq.${automationId}`,
        select: "id,gateway_id",
        limit: "1",
      }),
    );
    if (!Array.isArray(current) || !current.length)
      throw new HttpError(404, "Automation not found.");
    if (
      Object.hasOwn(body, "gateway_id") &&
      Number(body.gateway_id) !== current[0].gateway_id
    )
      throw new HttpError(400, "An automation cannot be moved to another gateway.");
    body.gateway_id = current[0].gateway_id;
  }

  const rule = parseRule(body);
  await verifyOwnerResources(config, token, rule);
  const saved = await supabaseRequest(
    config,
    token,
    "/rest/v1/rpc/save_automation",
    {
      method: "POST",
      body: {
        p_automation_id: automationId,
        p_gateway_id: rule.gateway_id,
        p_automation_name: rule.automation_name,
        p_logic_type: rule.logic_type,
        p_cooldown_seconds: rule.cooldown_seconds,
        p_conditions: rule.conditions,
        p_actions: rule.actions,
      },
    },
  );
  return Array.isArray(saved) ? saved[0] : saved;
}

async function remove(config, token, rawId) {
  const id = databaseId(rawId, "automation ID");
  const deleted = await supabaseRequest(
    config,
    token,
    query("automations", { id: `eq.${id}`, select: "id" }),
    { method: "DELETE", prefer: "return=representation" },
  );
  if (!Array.isArray(deleted) || !deleted.length)
    throw new HttpError(404, "Automation not found.");
  return { ok: true };
}

async function logs(config, token, rawId) {
  const id = databaseId(rawId, "automation ID");
  const owned = await supabaseRequest(
    config,
    token,
    query("automations", { id: `eq.${id}`, select: "id", limit: "1" }),
  );
  if (!Array.isArray(owned) || !owned.length)
    throw new HttpError(404, "Automation not found.");
  const rows = await supabaseRequest(
    config,
    token,
    query("automation_logs", {
      automation_id: `eq.${id}`,
      select: "id,automation_id,gateway_id,triggered_at,trigger_snapshot,actions_taken,success",
      order: "triggered_at.desc",
      limit: "50",
    }),
  );
  return { logs: Array.isArray(rows) ? rows : [] };
}

module.exports = { save, remove, logs };
