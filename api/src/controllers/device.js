"use strict";
const { HttpError } = require("../errors");
const { supabaseRequest, query, assertApprovedNode } = require("../supabase");
const { readBody } = require("../http");
const {
  requireKeys,
  requireText,
  requireId,
  validatePin,
  DEVICE_PINS,
} = require("../validators");
async function create(req, config, token) {
  const b = await readBody(req);
  requireKeys(b, ["gateway_id", "node_id", "device_name", "pin"]);
  const gateway_id = requireId(b.gateway_id, "gateway ID"),
    node_id = Number(b.node_id);
  if (!Number.isSafeInteger(node_id) || node_id < 0)
    throw new HttpError(400, "সঠিক node ID দিন।");
  if (node_id > 0) await assertApprovedNode(config, token, node_id, gateway_id);
  const data = await supabaseRequest(config, token, "/rest/v1/devices", {
    method: "POST",
    prefer: "return=representation",
    body: {
      gateway_id,
      node_id,
      device_name: requireText(b.device_name, "Device-এর নাম"),
      pin: validatePin(b.pin, DEVICE_PINS),
    },
  });
  return Array.isArray(data) ? data[0] : data;
}
async function state(req, config, token, id) {
  const b = await readBody(req);
  requireKeys(b, ["is_on"]);
  if (typeof b.is_on !== "boolean")
    throw new HttpError(400, "is_on true/false হতে হবে।");
  const data = await supabaseRequest(
    config,
    token,
    query("device_states", {
      device_id: `eq.${requireId(id, "device ID")}`,
      select: "device_id,is_on,updated_at",
    }),
    {
      method: "PATCH",
      prefer: "return=representation",
      body: { is_on: b.is_on },
    },
  );
  if (!Array.isArray(data) || !data.length)
    throw new HttpError(404, "Device state পাওয়া যায়নি।");
  return data[0];
}
async function remove(config, token, id) {
  const data = await supabaseRequest(
    config,
    token,
    query("devices", { id: `eq.${requireId(id, "device ID")}`, select: "id" }),
    { method: "DELETE", prefer: "return=representation" },
  );
  if (!Array.isArray(data) || !data.length)
    throw new HttpError(404, "Device পাওয়া যায়নি।");
  return { ok: true };
}
module.exports = { create, state, remove };
