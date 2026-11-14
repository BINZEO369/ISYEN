"use strict";
const { HttpError } = require("./errors");
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};
const MAX_BODY_BYTES = 64 * 1024;
function send(res, status, payload) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(JSON_HEADERS))
    res.setHeader(key, value);
  res.end(JSON.stringify(payload));
}
function applyCors(req, res) {
  const origin = req.headers && req.headers.origin;
  if (!origin) return;
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
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
  const length = Number(req.headers && req.headers["content-length"]);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES)
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
      throw Error("invalid");
    return value;
  } catch {
    throw new HttpError(400, "সঠিক JSON তথ্য পাঠান।");
  }
}
module.exports = { send, applyCors, getRoute, readBody };
