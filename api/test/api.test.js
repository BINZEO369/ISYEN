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
    automations: [],
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


test("accepts LDR sensor pin 32 on an approved Sub Node", async () => {
  let inserted;
  mockAuthAndDatabase((parsed, options) => {
    if (parsed.pathname === "/rest/v1/nodes")
      return mockResponse(200, [{ id: 7 }]);
    if (parsed.pathname === "/rest/v1/sensors" && options.method === "POST") {
      inserted = JSON.parse(options.body);
      return mockResponse(201, [{ id: 12, ...inserted }]);
    }
    return mockResponse(200, []);
  });
  const result = await callApi({
    method: "POST",
    url: "/api/sensors",
    headers: { authorization: "Bearer valid-user-token" },
    body: {
      gateway_id: 1,
      node_id: 7,
      sensor_name: "Hall light",
      pin: 32,
      sensor_type: "LDR",
      pir_trigger_state: "HIGH",
    },
  });
  assert.equal(result.status, 201);
  assert.equal(inserted.sensor_type, "LDR");
  assert.equal(inserted.pin, 32);
  assert.equal(inserted.node_id, 7);
});

test("rejects a Sub Node-only sensor on the main Gateway board", async () => {
  const calls = mockAuthAndDatabase(() => mockResponse(200, []));
  const result = await callApi({
    method: "POST",
    url: "/api/sensors",
    headers: { authorization: "Bearer valid-user-token" },
    body: {
      gateway_id: 1,
      node_id: 0,
      sensor_name: "Rain sensor",
      pin: 32,
      sensor_type: "RAIN",
      pir_trigger_state: "HIGH",
    },
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /Sub Node/);
  assert.equal(calls.filter((call) => call.method === "POST").length, 0);
});

test("saves automation rules through the authenticated atomic RPC", async () => {
  let rpcCall;
  const calls = mockAuthAndDatabase((parsed, options) => {
    if (parsed.pathname === "/rest/v1/gateways")
      return mockResponse(200, [{ id: 1 }]);
    if (parsed.pathname === "/rest/v1/sensors")
      return mockResponse(200, [{ id: 11, sensor_type: "TOUCH" }]);
    if (parsed.pathname === "/rest/v1/devices")
      return mockResponse(200, [{ id: 22 }]);
    if (parsed.pathname === "/rest/v1/rpc/save_automation") {
      rpcCall = { options, path: parsed.pathname };
      return mockResponse(200, { id: 9 });
    }
    return mockResponse(200, []);
  });
  const result = await callApi({
    method: "POST",
    url: "/api/automations",
    headers: { authorization: "Bearer valid-user-token" },
    body: {
      gateway_id: 1,
      automation_name: "Touch lamp",
      logic_type: "AND",
      cooldown_seconds: 0,
      conditions: [{ sensor_id: 11, operator: "eq", value: 1 }],
      actions: [{ device_id: 22, action_type: "on", delay_seconds: 5 }],
    },
  });
  assert.equal(result.status, 201);
  assert.deepEqual(result.body, { id: 9 });
  assert.equal(rpcCall.path, "/rest/v1/rpc/save_automation");
  assert.equal(rpcCall.options.method, "POST");
  const payload = JSON.parse(rpcCall.options.body);
  assert.equal(payload.p_automation_id, null);
  assert.equal(payload.p_gateway_id, 1);
  assert.equal(payload.p_cooldown_seconds, 0);
  assert.deepEqual(payload.p_conditions, [
    { sensor_id: 11, operator: "eq", value: 1 },
  ]);
  assert.ok(
    calls.every(
      (call) => call.headers.authorization === "Bearer valid-user-token",
    ),
  );
  assert.ok(
    calls.every((call) => call.headers.apikey === "sb_publishable_test_key"),
  );
});

test("rejects analog comparisons on digital sensor conditions before any write", async () => {
  const calls = mockAuthAndDatabase((parsed) => {
    if (parsed.pathname === "/rest/v1/gateways")
      return mockResponse(200, [{ id: 1 }]);
    if (parsed.pathname === "/rest/v1/sensors")
      return mockResponse(200, [{ id: 11, sensor_type: "WATER_LEAK" }]);
    if (parsed.pathname === "/rest/v1/devices")
      return mockResponse(200, [{ id: 22 }]);
    return mockResponse(200, []);
  });
  const result = await callApi({
    method: "POST",
    url: "/api/automations",
    headers: { authorization: "Bearer valid-user-token" },
    body: {
      gateway_id: 1,
      automation_name: "Invalid rule",
      logic_type: "AND",
      cooldown_seconds: 10,
      conditions: [{ sensor_id: 11, operator: "gt", value: 1 }],
      actions: [{ device_id: 22, action_type: "on", delay_seconds: 0 }],
    },
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /Digital sensors/);
  assert.equal(
    calls.filter((call) => call.method === "POST" || call.method === "PATCH").length,
    0,
  );
});

test("toggles only an owned automation with a boolean enabled value", async () => {
  let mutation;
  mockAuthAndDatabase((parsed, options) => {
    if (parsed.pathname === "/rest/v1/automations" && options.method === "PATCH") {
      mutation = { options, search: parsed.searchParams };
      return mockResponse(200, [{ id: 9, enabled: false }]);
    }
    return mockResponse(200, []);
  });
  const result = await callApi({
    method: "PATCH",
    url: "/api/automations/9",
    headers: { authorization: "Bearer valid-user-token" },
    body: { enabled: false },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { id: 9, enabled: false });
  assert.equal(mutation.options.headers.authorization, "Bearer valid-user-token");
  assert.deepEqual(JSON.parse(mutation.options.body), { enabled: false });
});

test("reads only the selected automation's latest 50 logs", async () => {
  let logQuery;
  mockAuthAndDatabase((parsed) => {
    if (parsed.pathname === "/rest/v1/automations")
      return mockResponse(200, [{ id: 9 }]);
    if (parsed.pathname === "/rest/v1/automation_logs") {
      logQuery = parsed.searchParams;
      return mockResponse(200, [{ id: 101, automation_id: 9, success: true }]);
    }
    return mockResponse(200, []);
  });
  const result = await callApi({
    url: "/api/automations/9/logs",
    headers: { authorization: "Bearer valid-user-token" },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.logs[0].automation_id, 9);
  assert.equal(logQuery.get("limit"), "50");
  assert.equal(logQuery.get("automation_id"), "eq.9");
  assert.doesNotMatch(logQuery.get("select"), /\*/);
});

test("does not allow editing an automation into another gateway", async () => {
  const calls = mockAuthAndDatabase((parsed) => {
    if (parsed.pathname === "/rest/v1/automations")
      return mockResponse(200, [{ id: 9, gateway_id: 1 }]);
    return mockResponse(200, []);
  });
  const result = await callApi({
    method: "PATCH",
    url: "/api/automations/9",
    headers: { authorization: "Bearer valid-user-token" },
    body: {
      gateway_id: 2,
      automation_name: "Move rule",
      logic_type: "AND",
      cooldown_seconds: 30,
      conditions: [{ sensor_id: 11, operator: "eq", value: 1 }],
      actions: [{ device_id: 22, action_type: "on", delay_seconds: 0 }],
    },
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /cannot be moved/);
  assert.equal(calls.filter((call) => call.method === "POST").length, 0);
});

test("deletes an automation through its parent row so database cascades remove its history", async () => {
  let deletedPath;
  mockAuthAndDatabase((parsed, options) => {
    if (parsed.pathname === "/rest/v1/automations" && options.method === "DELETE") {
      deletedPath = parsed.pathname;
      return mockResponse(200, [{ id: 9 }]);
    }
    return mockResponse(200, []);
  });
  const result = await callApi({
    method: "DELETE",
    url: "/api/automations/9",
    headers: { authorization: "Bearer valid-user-token" },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.equal(deletedPath, "/rest/v1/automations");
});
