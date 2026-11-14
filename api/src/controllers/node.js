"use strict";
const { HttpError } = require("../errors");
const { supabaseRequest, query } = require("../supabase");
const { readBody } = require("../http");
const { requireKeys, requireText, requireId } = require("../validators");
async function update(req, config, token, id) {
  const body = await readBody(req);
  requireKeys(body, ["node_name", "is_approved"]);
  if (typeof body.is_approved !== "boolean")
    throw new HttpError(400, "is_approved true/false হতে হবে।");
  const patch = { is_approved: body.is_approved };
  if (Object.hasOwn(body, "node_name"))
    patch.node_name = requireText(body.node_name, "Node-এর নাম");
  const data = await supabaseRequest(
    config,
    token,
    query("nodes", {
      id: `eq.${requireId(id, "node ID")}`,
      select: "id,gateway_id,node_name,mac_address,is_approved",
    }),
    { method: "PATCH", prefer: "return=representation", body: patch },
  );
  if (!Array.isArray(data) || !data.length)
    throw new HttpError(404, "Node পাওয়া যায়নি।");
  return data[0];
}
async function remove(config, token, id) {
  const nodeId = requireId(id, "node ID");
  const owned = await supabaseRequest(
    config,
    token,
    query("nodes", { id: `eq.${nodeId}`, select: "id", limit: "1" }),
  );
  if (!Array.isArray(owned) || !owned.length)
    throw new HttpError(404, "Node পাওয়া যায়নি।");
  const filter = `eq.${nodeId}`;
  await supabaseRequest(
    config,
    token,
    query("sensors", { node_id: filter, select: "id" }),
    { method: "DELETE", prefer: "return=representation" },
  );
  await supabaseRequest(
    config,
    token,
    query("devices", { node_id: filter, select: "id" }),
    { method: "DELETE", prefer: "return=representation" },
  );
  const data = await supabaseRequest(
    config,
    token,
    query("nodes", { id: `eq.${nodeId}`, select: "id" }),
    { method: "DELETE", prefer: "return=representation" },
  );
  if (!Array.isArray(data) || !data.length)
    throw new HttpError(404, "Node পাওয়া যায়নি।");
  return { ok: true };
}
module.exports = { update, remove };
