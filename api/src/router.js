"use strict";
const { HttpError } = require("./errors");
const {
  getSupabaseConfig,
  supabaseRequest,
  isPrivilegedKey,
} = require("./supabase");
const dashboard = require("./controllers/dashboard"),
  gateway = require("./controllers/gateway"),
  node = require("./controllers/node"),
  device = require("./controllers/device"),
  sensor = require("./controllers/sensor");
async function route(req, path, searchParams) {
  if (req.method === "GET" && path === "/health")
    return {
      ok: true,
      service: "ISYEN API",
      timestamp: new Date().toISOString(),
    };
  if (req.method === "GET" && path === "/config") {
    const key = process.env.SUPABASE_ANON_KEY;
    const result = {
      apiBaseUrl: process.env.PUBLIC_API_BASE_URL || "",
      supabaseUrl:
        process.env.SUPABASE_URL || "https://fabasazefdnkpygglajz.supabase.co",
    };
    if (key && !isPrivilegedKey(key)) result.supabaseAnonKey = key;
    return result;
  }
  const config = getSupabaseConfig(req),
    auth = req.headers && req.headers.authorization,
    match = typeof auth === "string" && auth.match(/^Bearer\s+(.+)$/i);
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
  const method = req.method || "GET";
  if (method === "GET" && path === "/dashboard")
    return dashboard.dashboard(config, token);
  if (method === "GET" && path === "/readings")
    return dashboard.readings(config, token, searchParams.get("type"));
  if (method === "POST" && path === "/gateways")
    return {
      status: 201,
      body: await gateway.create(req, config, token, user),
    };
  let m = path.match(/^\/nodes\/(\d+)$/);
  if (m && method === "PATCH") return node.update(req, config, token, m[1]);
  if (m && method === "DELETE") return node.remove(config, token, m[1]);
  if (method === "POST" && path === "/devices")
    return { status: 201, body: await device.create(req, config, token) };
  m = path.match(/^\/devices\/(\d+)\/state$/);
  if (m && method === "PATCH") return device.state(req, config, token, m[1]);
  m = path.match(/^\/devices\/(\d+)$/);
  if (m && method === "DELETE") return device.remove(config, token, m[1]);
  if (method === "POST" && path === "/sensors")
    return { status: 201, body: await sensor.create(req, config, token) };
  m = path.match(/^\/sensors\/(\d+)$/);
  if (m && method === "DELETE") return sensor.remove(config, token, m[1]);
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
    const error = new HttpError(405, "এই HTTP method অনুমোদিত নয়।");
    error.allow = "GET, POST, PATCH, DELETE, OPTIONS";
    throw error;
  }
  throw new HttpError(404, "API endpoint পাওয়া যায়নি।");
}
module.exports = route;
