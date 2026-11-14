"use strict";
const { HttpError } = require("./errors");
function isPrivilegedKey(key) {
  if (!key || /service_role|sb_secret_/i.test(key)) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    return (
      JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role ===
      "service_role"
    );
  } catch {
    return false;
  }
}
function getSupabaseConfig(req) {
  const url =
    process.env.SUPABASE_URL || "https://fabasazefdnkpygglajz.supabase.co";
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    req.headers?.apikey ||
    req.headers?.["x-supabase-anon-key"];
  if (!anonKey || isPrivilegedKey(String(anonKey)))
    throw new HttpError(
      503,
      "Set the Supabase public anon key in the server configuration.",
      "SUPABASE_CONFIG_MISSING",
    );
  return { url: url.replace(/\/+$/, ""), anonKey: String(anonKey) };
}
async function supabaseRequest(config, accessToken, path, options = {}) {
  const response = await fetch(`${config.url}${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: config.anonKey,
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.prefer ? { prefer: options.prefer } : {}),
      ...(options.headers || {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const code = data && typeof data.code === "string" ? data.code : undefined;
    const msg =
      data && typeof data.message === "string"
        ? data.message
        : "The Supabase request could not be completed.";
    throw new HttpError(response.status, msg, code);
  }
  return data;
}
async function supabaseAuthRequest(config, path, options = {}) {
  const headers = {
    apikey: config.anonKey,
    accept: "application/json",
    ...(options.body ? { "content-type": "application/json" } : {}),
    ...(options.accessToken
      ? { authorization: `Bearer ${options.accessToken}` }
      : {}),
  };
  const response = await fetch(`${config.url}${path}`, {
    method: options.method || "POST",
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const code =
      (data && (data.code || data.error_code)) || undefined;
    const message =
      (data && (data.message || data.msg || data.error_description)) ||
      "The Supabase Auth request could not be completed.";
    throw new HttpError(response.status, message, code);
  }
  return data;
}
function query(table, params) {
  return `/rest/v1/${table}?${new URLSearchParams(params).toString()}`;
}
async function loadLatestReadings(config, token, sensors) {
  const limited = sensors.slice(0, 200),
    rows = [];
  for (let i = 0; i < limited.length; i += 20) {
    const result = await Promise.all(
      limited.slice(i, i + 20).map(async (sensor) => {
        const data = await supabaseRequest(
          config,
          token,
          query("sensor_readings", {
            select:
              "sensor_id,temperature,humidity,gas_value,motion,door_state,created_at",
            sensor_id: `eq.${sensor.id}`,
            order: "created_at.desc",
            limit: "1",
          }),
        );
        return Array.isArray(data) ? data[0] : null;
      }),
    );
    rows.push(...result.filter(Boolean));
  }
  return rows;
}
async function assertApprovedNode(config, token, nodeId, gatewayId) {
  const nodes = await supabaseRequest(
    config,
    token,
    query("nodes", {
      id: `eq.${nodeId}`,
      gateway_id: `eq.${gatewayId}`,
      is_approved: "eq.true",
      select: "id",
      limit: "1",
    }),
  );
  if (!Array.isArray(nodes) || !nodes.length)
    throw new HttpError(
      400,
      "Select an approved Sub Node for the selected Gateway.",
    );
}
module.exports = {
  isPrivilegedKey,
  getSupabaseConfig,
  supabaseRequest,
  supabaseAuthRequest,
  query,
  loadLatestReadings,
  assertApprovedNode,
};
