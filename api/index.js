"use strict";

const crypto = require("node:crypto");

const API_PREFIX = "/api";
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};
const TABLE_LIMIT = 1000;
const MAX_BODY_BYTES = 64 * 1024;
const VALID_SENSOR_TYPES = new Set([
  "DHT11",
  "DHT22",
  "DHT",
  "MQ2",
  "MQ135",
  "PIR",
  "REED",
]);
const DEVICE_PINS = new Set([4, 5, 13, 14, 16, 17, 18, 21, 22, 23, 25, 33]);
const SENSOR_PINS = new Set([
  4, 5, 13, 14, 15, 16, 17, 18, 21, 22, 23, 25, 33, 34, 35, 36, 39,
]);

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function send(res, status, payload) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(JSON_HEADERS))
    res.setHeader(key, value);
  res.end(JSON.stringify(payload));
}

function isPrivilegedKey(key) {
  if (!key || /service_role|sb_secret_/i.test(key)) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

function applyCors(req, res) {
  const origin = req.headers && req.headers.origin;
  if (!origin) return;
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV !== "production")
    allowed.push("http://localhost:3000", "http://127.0.0.1:3000");
  if (!allowed.includes(origin))
    throw new HttpError(
      403,
      "এই website origin থেকে API access অনুমোদিত নয়।",
      "ORIGIN_NOT_ALLOWED",
    );
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("vary", "Origin");
  res.setHeader(
    "access-control-allow-methods",
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  res.setHeader(
    "access-control-allow-headers",
    "Authorization, Content-Type, apikey",
  );
  res.setHeader("access-control-max-age", "600");
}

function getRoute(req) {
  const parsed = new URL(req.url || "/", "http://localhost");
  const queryPath = req.query && (req.query.path || req.query.resource);
  let path =
    typeof queryPath === "string"
      ? queryPath
      : parsed.pathname.replace(/^\/api\/?/, "");
  path = `/${String(path).replace(/^\/+/, "")}`.replace(/\/+$/, "") || "/";
  return { path, searchParams: parsed.searchParams };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const contentLength = Number(req.headers && req.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES)
    throw new HttpError(413, "অনুরোধের তথ্য অতিরিক্ত বড়।");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES)
      throw new HttpError(413, "অনুরোধের তথ্য অতিরিক্ত বড়।");
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("invalid");
    return value;
  } catch {
    throw new HttpError(400, "সঠিক JSON তথ্য পাঠান।");
  }
}

function requireText(value, field, max = 80) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${field} আবশ্যক (সর্বোচ্চ ${max} অক্ষর)।`);
  }
  return value.trim();
}

function requireId(value, field = "ID") {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new HttpError(400, `সঠিক ${field} দিন।`);
  return id;
}

function validatePin(value, allowed) {
  const pin = Number(value);
  if (!Number.isInteger(pin) || !allowed.has(pin))
    throw new HttpError(400, "এই GPIO pin অনুমোদিত নয়।");
  return pin;
}

function requireKeys(body, keys) {
  const extra = Object.keys(body).filter((key) => !keys.includes(key));
  if (extra.length) throw new HttpError(400, "অনুরোধে অচেনা field রয়েছে।");
}

function getSupabaseConfig(req) {
  const url =
    process.env.SUPABASE_URL || "https://fabasazefdnkpygglajz.supabase.co";
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    req.headers?.apikey ||
    req.headers?.["x-supabase-anon-key"];
  if (!anonKey || isPrivilegedKey(String(anonKey))) {
    throw new HttpError(
      503,
      "Supabase public anon key server configuration-এ দিন।",
      "SUPABASE_CONFIG_MISSING",
    );
  }
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
        : "Supabase অনুরোধটি সম্পন্ন করতে পারেনি।";
    throw new HttpError(response.status, msg, code);
  }
  return data;
}

function query(table, params) {
  const values = new URLSearchParams(params);
  return `/rest/v1/${table}?${values.toString()}`;
}

function apiError(error) {
  if (error instanceof HttpError)
    return {
      status: error.status,
      body: {
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      },
    };
  if (error && error.code === "23505")
    return {
      status: 409,
      body: {
        error: "এই gateway claim code বা hardware address আগে থেকেই ব্যবহৃত।",
      },
    };
  if (error && error.code === "23503")
    return {
      status: 409,
      body: {
        error: "সংশ্লিষ্ট device-এ data যুক্ত আছে; আগে child records সরান।",
      },
    };
  if (error && error.code === "23514")
    return {
      status: 400,
      body: { error: "ডাটাবেজের অনুমোদিত মানের সঙ্গে তথ্য মিলছে না।" },
    };
  return {
    status: 500,
    body: { error: "সার্ভারে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।" },
  };
}

async function loadLatestReadings(config, token, sensors) {
  const limited = sensors.slice(0, 200);
  const batches = [];
  for (let i = 0; i < limited.length; i += 20)
    batches.push(limited.slice(i, i + 20));
  const rows = [];
  for (const batch of batches) {
    const result = await Promise.all(
      batch.map(async (sensor) => {
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
      "নির্বাচিত Gateway-এর অনুমোদিত Sub Node নির্বাচন করুন।",
    );
}

async function handle(req, res) {
  try {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("allow", "GET, POST, PATCH, DELETE, OPTIONS");
      return res.end();
    }
    const initialRoute = getRoute(req);
    if (req.method === "GET" && initialRoute.path === "/health") {
      return send(res, 200, {
        ok: true,
        service: "ISYEN API",
        timestamp: new Date().toISOString(),
      });
    }
    if (req.method === "GET" && initialRoute.path === "/config") {
      const configuredKey = process.env.SUPABASE_ANON_KEY;
      const publicConfig = {
        apiBaseUrl: process.env.PUBLIC_API_BASE_URL || "",
        supabaseUrl:
          process.env.SUPABASE_URL ||
          "https://fabasazefdnkpygglajz.supabase.co",
      };
      if (configuredKey && !isPrivilegedKey(configuredKey))
        publicConfig.supabaseAnonKey = configuredKey;
      return send(res, 200, publicConfig);
    }

    const config = getSupabaseConfig(req);
    const authorization = req.headers && req.headers.authorization;
    const match =
      typeof authorization === "string" &&
      authorization.match(/^Bearer\s+(.+)$/i);
    if (!match)
      throw new HttpError(401, "চালিয়ে যেতে লগইন করুন।", "AUTH_REQUIRED");
    const token = match[1].trim();
    const user = await supabaseRequest(config, token, "/auth/v1/user");
    if (!user || !user.id)
      throw new HttpError(
        401,
        "সেশনটি মেয়াদোত্তীর্ণ; আবার লগইন করুন।",
        "INVALID_SESSION",
      );

    const { path, searchParams } = getRoute(req);
    const method = req.method || "GET";

    if (method === "GET" && path === "/dashboard") {
      const [gateways, nodes, devices, sensors] = await Promise.all([
        supabaseRequest(
          config,
          token,
          query("gateways", {
            select:
              "id,user_id,gateway_name,mac_address,claim_code,last_seen,created_at",
            order: "created_at.asc",
            limit: String(TABLE_LIMIT),
          }),
        ),
        supabaseRequest(
          config,
          token,
          query("nodes", {
            select:
              "id,gateway_id,node_name,mac_address,is_approved,created_at",
            order: "id.asc",
            limit: String(TABLE_LIMIT),
          }),
        ),
        supabaseRequest(
          config,
          token,
          query("devices", {
            select:
              "id,gateway_id,node_id,device_name,pin,created_at,device_states(is_on,updated_at)",
            order: "id.asc",
            limit: String(TABLE_LIMIT),
          }),
        ),
        supabaseRequest(
          config,
          token,
          query("sensors", {
            select:
              "id,gateway_id,node_id,sensor_name,pin,sensor_type,pir_trigger_state,created_at",
            order: "id.asc",
            limit: String(TABLE_LIMIT),
          }),
        ),
      ]);
      const readings = await loadLatestReadings(
        config,
        token,
        Array.isArray(sensors) ? sensors : [],
      );
      return send(res, 200, { gateways, nodes, devices, sensors, readings });
    }

    if (method === "GET" && path === "/readings") {
      const type = searchParams.get("type");
      if (!["fast", "slow", null].includes(type))
        throw new HttpError(400, "type fast বা slow হতে হবে।");
      let sensors = await supabaseRequest(
        config,
        token,
        query("sensors", {
          select: "id,sensor_type",
          order: "id.asc",
          limit: String(TABLE_LIMIT),
        }),
      );
      if (type === "fast")
        sensors = sensors.filter((item) =>
          ["PIR", "REED"].includes(item.sensor_type),
        );
      if (type === "slow")
        sensors = sensors.filter(
          (item) => !["PIR", "REED"].includes(item.sensor_type),
        );
      return send(res, 200, {
        readings: await loadLatestReadings(config, token, sensors),
      });
    }

    if (method === "POST" && path === "/gateways") {
      const body = await readBody(req);
      requireKeys(body, ["gateway_name"]);
      const gateway_name = requireText(body.gateway_name, "Gateway-এর নাম");
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const claim_code = Array.from(
          { length: 8 },
          () => "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[crypto.randomInt(36)],
        ).join("");
        try {
          const data = await supabaseRequest(
            config,
            token,
            "/rest/v1/gateways",
            {
              method: "POST",
              prefer: "return=representation",
              body: { user_id: user.id, gateway_name, claim_code },
            },
          );
          return send(res, 201, Array.isArray(data) ? data[0] : data);
        } catch (error) {
          if (error.code !== "23505" || attempt === 3) throw error;
        }
      }
    }

    const nodeMatch = path.match(/^\/nodes\/(\d+)$/);
    if (nodeMatch && method === "PATCH") {
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
          id: `eq.${requireId(nodeMatch[1], "node ID")}`,
          select: "id,gateway_id,node_name,mac_address,is_approved",
        }),
        { method: "PATCH", prefer: "return=representation", body: patch },
      );
      if (!Array.isArray(data) || !data.length)
        throw new HttpError(404, "Node পাওয়া যায়নি।");
      return send(res, 200, data[0]);
    }
    if (nodeMatch && method === "DELETE") {
      const nodeId = requireId(nodeMatch[1], "node ID");
      const ownedNode = await supabaseRequest(
        config,
        token,
        query("nodes", { id: `eq.${nodeId}`, select: "id", limit: "1" }),
      );
      if (!Array.isArray(ownedNode) || !ownedNode.length)
        throw new HttpError(404, "Node পাওয়া যায়নি।");
      const childFilter = `eq.${nodeId}`;
      await supabaseRequest(
        config,
        token,
        query("sensors", { node_id: childFilter, select: "id" }),
        { method: "DELETE", prefer: "return=representation" },
      );
      await supabaseRequest(
        config,
        token,
        query("devices", { node_id: childFilter, select: "id" }),
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
      return send(res, 200, { ok: true });
    }

    if (method === "POST" && path === "/devices") {
      const body = await readBody(req);
      requireKeys(body, ["gateway_id", "node_id", "device_name", "pin"]);
      const gatewayId = requireId(body.gateway_id, "gateway ID");
      const nodeId = Number(body.node_id);
      if (!Number.isSafeInteger(nodeId) || nodeId < 0)
        throw new HttpError(400, "সঠিক node ID দিন।");
      if (nodeId > 0)
        await assertApprovedNode(config, token, nodeId, gatewayId);
      const data = await supabaseRequest(config, token, "/rest/v1/devices", {
        method: "POST",
        prefer: "return=representation",
        body: {
          gateway_id: gatewayId,
          node_id: nodeId,
          device_name: requireText(body.device_name, "Device-এর নাম"),
          pin: validatePin(body.pin, DEVICE_PINS),
        },
      });
      return send(res, 201, Array.isArray(data) ? data[0] : data);
    }
    const deviceStateMatch = path.match(/^\/devices\/(\d+)\/state$/);
    if (deviceStateMatch && method === "PATCH") {
      const body = await readBody(req);
      requireKeys(body, ["is_on"]);
      if (typeof body.is_on !== "boolean")
        throw new HttpError(400, "is_on true/false হতে হবে।");
      const data = await supabaseRequest(
        config,
        token,
        query("device_states", {
          device_id: `eq.${requireId(deviceStateMatch[1], "device ID")}`,
          select: "device_id,is_on,updated_at",
        }),
        {
          method: "PATCH",
          prefer: "return=representation",
          body: { is_on: body.is_on },
        },
      );
      if (!Array.isArray(data) || !data.length)
        throw new HttpError(404, "Device state পাওয়া যায়নি।");
      return send(res, 200, data[0]);
    }
    const deviceMatch = path.match(/^\/devices\/(\d+)$/);
    if (deviceMatch && method === "DELETE") {
      const data = await supabaseRequest(
        config,
        token,
        query("devices", {
          id: `eq.${requireId(deviceMatch[1], "device ID")}`,
          select: "id",
        }),
        { method: "DELETE", prefer: "return=representation" },
      );
      if (!Array.isArray(data) || !data.length)
        throw new HttpError(404, "Device পাওয়া যায়নি।");
      return send(res, 200, { ok: true });
    }

    if (method === "POST" && path === "/sensors") {
      const body = await readBody(req);
      requireKeys(body, [
        "gateway_id",
        "node_id",
        "sensor_name",
        "pin",
        "sensor_type",
        "pir_trigger_state",
      ]);
      if (!VALID_SENSOR_TYPES.has(body.sensor_type))
        throw new HttpError(400, "Sensor type অনুমোদিত নয়।");
      const nodeId = Number(body.node_id);
      if (!Number.isSafeInteger(nodeId) || nodeId < 0)
        throw new HttpError(400, "সঠিক node ID দিন।");
      if (["PIR", "REED"].includes(body.sensor_type) && nodeId === 0)
        throw new HttpError(
          400,
          "PIR ও REED sensor approved subnode-এ যুক্ত করতে হবে।",
        );
      const gatewayId = requireId(body.gateway_id, "gateway ID");
      if (nodeId > 0)
        await assertApprovedNode(config, token, nodeId, gatewayId);
      if (!["HIGH", "LOW"].includes(body.pir_trigger_state))
        throw new HttpError(400, "Trigger state HIGH বা LOW হতে হবে।");
      const data = await supabaseRequest(config, token, "/rest/v1/sensors", {
        method: "POST",
        prefer: "return=representation",
        body: {
          gateway_id: gatewayId,
          node_id: nodeId,
          sensor_name: requireText(body.sensor_name, "Sensor-এর নাম"),
          pin: validatePin(body.pin, SENSOR_PINS),
          sensor_type: body.sensor_type,
          pir_trigger_state: body.pir_trigger_state,
        },
      });
      return send(res, 201, Array.isArray(data) ? data[0] : data);
    }
    const sensorMatch = path.match(/^\/sensors\/(\d+)$/);
    if (sensorMatch && method === "DELETE") {
      const data = await supabaseRequest(
        config,
        token,
        query("sensors", {
          id: `eq.${requireId(sensorMatch[1], "sensor ID")}`,
          select: "id",
        }),
        { method: "DELETE", prefer: "return=representation" },
      );
      if (!Array.isArray(data) || !data.length)
        throw new HttpError(404, "Sensor পাওয়া যায়নি।");
      return send(res, 200, { ok: true });
    }

    if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
      res.setHeader("allow", "GET, POST, PATCH, DELETE, OPTIONS");
      throw new HttpError(405, "এই HTTP method অনুমোদিত নয়।");
    }
    throw new HttpError(404, "API endpoint পাওয়া যায়নি।");
  } catch (error) {
    const result = apiError(error);
    if (result.status >= 500 && !(error instanceof HttpError))
      console.error(
        "[ISYEN API]",
        error && error.code
          ? error.code
          : error && error.name
            ? error.name
            : "Unknown error",
      );
    return send(res, result.status, result.body);
  }
}

module.exports = handle;
module.exports.handle = handle;
