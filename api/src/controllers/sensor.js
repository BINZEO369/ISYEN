"use strict";
const { HttpError } = require("../errors");
const { supabaseRequest, query, assertApprovedNode } = require("../supabase");
const { readBody } = require("../http");
const {
  requireKeys,
  requireText,
  requireId,
  validatePin,
  SENSOR_PINS,
  VALID_SENSOR_TYPES,
} = require("../validators");
async function create(req, config, token) {
  const b = await readBody(req);
  requireKeys(b, [
    "gateway_id",
    "node_id",
    "sensor_name",
    "pin",
    "sensor_type",
    "pir_trigger_state",
  ]);
  if (!VALID_SENSOR_TYPES.has(b.sensor_type))
    throw new HttpError(400, "Sensor type is not supported.");
  const node_id = Number(b.node_id);
  if (!Number.isSafeInteger(node_id) || node_id < 0)
    throw new HttpError(400, "Please provide a valid node ID.");
  if (["PIR", "REED"].includes(b.sensor_type) && node_id === 0)
    throw new HttpError(
      400,
      "PIR and REED sensors must be connected to an approved Sub Node.",
    );
  const gateway_id = requireId(b.gateway_id, "gateway ID");
  if (node_id > 0) await assertApprovedNode(config, token, node_id, gateway_id);
  if (!["HIGH", "LOW"].includes(b.pir_trigger_state))
    throw new HttpError(400, "Trigger state must be HIGH or LOW.");
  const data = await supabaseRequest(config, token, "/rest/v1/sensors", {
    method: "POST",
    prefer: "return=representation",
    body: {
      gateway_id,
      node_id,
      sensor_name: requireText(b.sensor_name, "Sensor name"),
      pin: validatePin(b.pin, SENSOR_PINS),
      sensor_type: b.sensor_type,
      pir_trigger_state: b.pir_trigger_state,
    },
  });
  return Array.isArray(data) ? data[0] : data;
}
async function remove(config, token, id) {
  const data = await supabaseRequest(
    config,
    token,
    query("sensors", { id: `eq.${requireId(id, "sensor ID")}`, select: "id" }),
    { method: "DELETE", prefer: "return=representation" },
  );
  if (!Array.isArray(data) || !data.length)
    throw new HttpError(404, "Sensor not found.");
  return { ok: true };
}
module.exports = { create, remove };
