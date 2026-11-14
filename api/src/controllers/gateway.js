"use strict";
const crypto = require("node:crypto");
const { HttpError } = require("../errors");
const { supabaseRequest } = require("../supabase");
const { readBody } = require("../http");
const { requireKeys, requireText } = require("../validators");
async function create(req, config, token, user) {
  const body = await readBody(req);
  requireKeys(body, ["gateway_name"]);
  const gateway_name = requireText(body.gateway_name, "Gateway name");
  for (let attempt = 0; attempt < 4; attempt++) {
    const claim_code = Array.from(
      { length: 8 },
      () => "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[crypto.randomInt(36)],
    ).join("");
    try {
      const data = await supabaseRequest(config, token, "/rest/v1/gateways", {
        method: "POST",
        prefer: "return=representation",
        body: { user_id: user.id, gateway_name, claim_code },
      });
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      if (error.code !== "23505" || attempt === 3) throw error;
    }
  }
  throw new HttpError(500, "A server error occurred. Please try again later.");
}
module.exports = { create };
