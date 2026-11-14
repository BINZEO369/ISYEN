"use strict";
const { HttpError } = require("./errors");
const {
  getSupabaseConfig,
  supabaseRequest,
} = require("./supabase");
const authController = require("./controllers/auth");
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
  const config = getSupabaseConfig(req);
  const method = req.method || "GET";
  if (method === "POST" && path === "/auth/register")
    return authController.register(req, config);
  if (method === "POST" && path === "/auth/login")
    return authController.login(req, config);
  if (method === "POST" && path === "/auth/refresh")
    return authController.refresh(req, config);
  if (method === "GET" && path === "/auth/session")
    return authController.currentUser(req, config);
  if (method === "POST" && path === "/auth/logout")
    return authController.logout(req, config);

  const authorization = req.headers && req.headers.authorization;
  const match =
    typeof authorization === "string" &&
    authorization.match(/^Bearer\s+(.+)$/i);
  if (!match)
    throw new HttpError(401, "Please sign in to continue.", "AUTH_REQUIRED");
  const token = match[1].trim();
  const user = await supabaseRequest(config, token, "/auth/v1/user");
  if (!user || !user.id)
    throw new HttpError(
      401,
      "Your session has expired. Please sign in again.",
      "INVALID_SESSION",
    );
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
    const error = new HttpError(405, "This HTTP method is not allowed.");
    error.allow = "GET, POST, PATCH, DELETE, OPTIONS";
    throw error;
  }
  throw new HttpError(404, "API endpoint not found.");
}
module.exports = route;
