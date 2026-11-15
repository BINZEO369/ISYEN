"use strict";
const { supabaseRequest, query, loadLatestReadings } = require("../supabase");
const LIMIT = 1000;
async function dashboard(config, token) {
  const [gateways, nodes, devices, sensors, automations] = await Promise.all([
    supabaseRequest(
      config,
      token,
      query("gateways", {
        select:
          "id,user_id,gateway_name,mac_address,claim_code,last_seen,created_at",
        order: "created_at.asc",
        limit: String(LIMIT),
      }),
    ),
    supabaseRequest(
      config,
      token,
      query("nodes", {
        select: "id,gateway_id,node_name,mac_address,is_approved,created_at",
        order: "id.asc",
        limit: String(LIMIT),
      }),
    ),
    supabaseRequest(
      config,
      token,
      query("devices", {
        select:
          "id,gateway_id,node_id,device_name,pin,created_at,device_states(is_on,updated_at)",
        order: "id.asc",
        limit: String(LIMIT),
      }),
    ),
    supabaseRequest(
      config,
      token,
      query("sensors", {
        select:
          "id,gateway_id,node_id,sensor_name,pin,sensor_type,pir_trigger_state,created_at",
        order: "id.asc",
        limit: String(LIMIT),
      }),
    ),
    supabaseRequest(
      config,
      token,
      query("automations", {
        select:
          "id,gateway_id,automation_name,enabled,logic_type,cooldown_seconds,trigger_count,last_triggered_at,created_at,automation_conditions(id,sensor_id,operator,value,order_index),automation_actions(id,device_id,action_type,delay_seconds,order_index)",
        order: "id.asc",
        limit: String(LIMIT),
      }),
    ),
  ]);
  return {
    gateways,
    nodes,
    devices,
    sensors,
    automations,
    readings: await loadLatestReadings(
      config,
      token,
      Array.isArray(sensors) ? sensors : [],
    ),
  };
}
async function readings(config, token, type) {
  if (!["fast", "slow", null].includes(type)) {
    const { HttpError } = require("../errors");
    throw new HttpError(400, "Type must be fast or slow.");
  }
  let sensors = await supabaseRequest(
    config,
    token,
    query("sensors", {
      select: "id,sensor_type",
      order: "id.asc",
      limit: String(LIMIT),
    }),
  );
  const fastTypes = ["PIR", "REED", "WATER_LEAK", "TOUCH"];
  if (type === "fast")
    sensors = sensors.filter((x) => fastTypes.includes(x.sensor_type));
  if (type === "slow")
    sensors = sensors.filter((x) => !fastTypes.includes(x.sensor_type));
  return { readings: await loadLatestReadings(config, token, sensors) };
}
module.exports = { dashboard, readings };
