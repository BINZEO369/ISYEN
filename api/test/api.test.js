"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const handle = require("../src/server");

process.env.SUPABASE_URL = "https://supabase.example.test";
process.env.SUPABASE_ANON_KEY = "sb_publishable_test_key";
delete process.env.ALLOWED_ORIGINS;

function mockResponse(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function callApi({
  method = "GET",
  url = "/api/dashboard",
  headers = {},
  body,
} = {}) {
  const req = { method, url, headers, body };
  const outputHeaders = {};
  const res = {
    statusCode: 200,
    setHeader(name, value) {
      outputHeaders[name.toLowerCase()] = value;
    },
    end(payload) {
      this.payload = payload ? JSON.parse(payload) : null;
    },
  };
  await handle(req, res);
  return { status: res.statusCode, body: res.payload, headers: outputHeaders };
}

function mockAuthAndDatabase(routeHandler) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method || "GET",
      headers: options.headers,
    });
    if (parsed.pathname === "/auth/v1/user")
      return mockResponse(200, { id: "user-123", email: "owner@example.com" });
    return routeHandler(parsed, options);
  };
  return calls;
}

test("registers through Supabase Auth with the server-side publishable key", async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), ...options };
    return mockResponse(200, {
      id: "user-new",
      email: "new@example.com",
    });
  };
  const result = await callApi({
    method: "POST",
    url: "/api/auth/register",
    body: { email: "new@example.com", password: "correct-horse" },
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.session, null);
  assert.equal(result.body.needsEmailVerification, true);
  assert.equal(request.url, "https://supabase.example.test/auth/v1/signup");
  assert.equal(request.headers.apikey, "sb_publishable_test_key");
  assert.equal(request.headers.authorization, undefined);
});

test("logs in through Supabase Auth and returns its session", async () => {
  const session = {
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    user: { id: "user-123", email: "owner@example.com" },
  };
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), ...options };
    return mockResponse(200, session);
  };
  const result = await callApi({
    method: "POST",
    url: "/api/auth/login",
    body: { email: "owner@example.com", password: "correct-horse" },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.session, session);
  assert.equal(
    request.url,
    "https://supabase.example.test/auth/v1/token?grant_type=password",
  );
  assert.equal(request.headers.apikey, "sb_publishable_test_key");
  assert.equal(request.headers.authorization, undefined);
});

test("refreshes an expired session through the server API", async () => {
  let request;
  global.fetch = async (url, options) => {
    request = { url: String(url), ...options };
    return mockResponse(200, {
      access_token: "new-access-token",
      refresh_token: "rotated-refresh-token",
      user: { id: "user-123", email: "owner@example.com" },
    });
  };
  const result = await callApi({
    method: "POST",
    url: "/api/auth/refresh",
    body: { refresh_token: "old-refresh-token" },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.session.access_token, "new-access-token");
  assert.equal(
    request.url,
    "https://supabase.example.test/auth/v1/token?grant_type=refresh_token",
  );
  assert.equal(request.headers.apikey, "sb_publishable_test_key");
});

test("rejects protected dashboard requests without a user session", async () => {
  let networkCalls = 0;
  global.fetch = async () => {
    networkCalls += 1;
    throw new Error("unexpected network access");
  };
  const result = await callApi();
  assert.equal(result.status, 401);
  assert.equal(result.body.code, "AUTH_REQUIRED");
  assert.equal(networkCalls, 0);
});

test("returns dashboard data only after Supabase user validation", async () => {
  const calls = mockAuthAndDatabase(() => mockResponse(200, []));
  const result = await callApi({
    headers: { authorization: "Bearer valid-user-token" },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    gateways: [],
    nodes: [],
    devices: [],
    sensors: [],
    readings: [],
  });
  assert.ok(calls.length >= 5);
  assert.ok(
    calls.every(
      (call) => call.headers.authorization === "Bearer valid-user-token",
    ),
  );
  assert.ok(
    calls.every((call) => call.headers.apikey === "sb_publishable_test_key"),
  );
});

test("creates gateways with the authenticated owner and a generated claim code", async () => {
  let inserted;
  mockAuthAndDatabase((parsed, options) => {
    if (parsed.pathname === "/rest/v1/gateways" && options.method === "POST") {
      inserted = JSON.parse(options.body);
      return mockResponse(201, [{ id: 5, ...inserted }]);
    }
    return mockResponse(200, []);
  });
  const result = await callApi({
    method: "POST",
    url: "/api/gateways",
    headers: { authorization: "Bearer valid-user-token" },
    body: { gateway_name: "Main board" },
  });
  assert.equal(result.status, 201);
  assert.equal(inserted.user_id, "user-123");
  assert.equal(inserted.gateway_name, "Main board");
  assert.match(inserted.claim_code, /^[A-Z0-9]{8}$/);
});

test("rejects an invalid GPIO before any database mutation", async () => {
  const calls = mockAuthAndDatabase(() => mockResponse(200, []));
  const result = await callApi({
    method: "POST",
    url: "/api/devices",
    headers: { authorization: "Bearer valid-user-token" },
    body: { gateway_id: 1, node_id: 0, device_name: "Desk light", pin: 12 },
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /GPIO/);
  assert.equal(calls.filter((call) => call.method !== "GET").length, 0);
});

test("deletes owned node child sensors and devices before the node", async () => {
  const calls = mockAuthAndDatabase((parsed, options) => {
    if (parsed.pathname.endsWith("/nodes"))
      return mockResponse(200, [{ id: 7 }]);
    return mockResponse(200, []);
  });
  const result = await callApi({
    method: "DELETE",
    url: "/api/nodes/7",
    headers: { authorization: "Bearer valid-user-token" },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
  const mutations = calls
    .filter((call) => call.method === "DELETE")
    .map((call) => call.path.split("?")[0]);
  assert.deepEqual(mutations, [
    "/rest/v1/sensors",
    "/rest/v1/devices",
    "/rest/v1/nodes",
  ]);
});
