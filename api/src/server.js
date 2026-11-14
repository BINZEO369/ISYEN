"use strict";
const { send, applyCors, getRoute } = require("./http");
const { apiError } = require("./errors");
const route = require("./router");
async function handle(req, res) {
  try {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("allow", "GET, POST, PATCH, DELETE, OPTIONS");
      return res.end();
    }
    const { path, searchParams } = getRoute(req);
    const result = await route(req, path, searchParams);
    return send(
      res,
      result && result.status ? result.status : 200,
      result && Object.hasOwn(result, "body") ? result.body : result,
    );
  } catch (error) {
    if (error && error.allow) res.setHeader("allow", error.allow);
    const result = apiError(error);
    if (result.status >= 500 && !(error && error.status))
      console.error(
        "[ISYEN API]",
        (error && (error.code || error.name)) || "Unknown error",
      );
    return send(res, result.status, result.body);
  }
}
module.exports = handle;
module.exports.handle = handle;
