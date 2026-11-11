import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const { forwardedDashboardQuery, getBearerAuthorization, isAllowedDashboardResource } = await import("../lib/resource-proxy.ts");

test("dashboard reads are allowlisted and home is the only create resource", () => {
  for (const resource of ["homes", "rooms", "devices", "gateways", "scenes", "automations"]) {
    assert.equal(isAllowedDashboardResource(resource, "GET"), true, `${resource} should be readable`);
  }
  assert.equal(isAllowedDashboardResource("admin_users", "GET"), false);
  assert.equal(isAllowedDashboardResource("user_profiles", "POST"), false);
  assert.equal(isAllowedDashboardResource("devices", "POST"), false);
  assert.equal(isAllowedDashboardResource("homes", "POST"), true);
});

test("proxy accepts a non-empty bearer token and rejects absent or blank tokens", () => {
  assert.equal(getBearerAuthorization(new Request("https://app.example.test", { headers: { authorization: "Bearer user-token" } })), "Bearer user-token");
  assert.equal(getBearerAuthorization(new Request("https://app.example.test")), null);
  assert.equal(getBearerAuthorization(new Request("https://app.example.test", { headers: { authorization: "Bearer    " } })), null);
});

test("only supported resource query parameters are forwarded", () => {
  const query = forwardedDashboardQuery(new URLSearchParams("limit=20&order=asc&home_id=home-1&unexpected=secret&admin=true"));
  assert.deepEqual([...query.entries()], [["limit", "20"], ["order", "asc"], ["home_id", "home-1"]]);
});

test("route manifest keeps dashboard and account as separate top-level pages", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/manus-routes.json", import.meta.url), "utf8"));
  const paths = manifest.routes.map((route) => route.path);
  assert.ok(paths.includes("/dashboard"));
  assert.ok(paths.includes("/account"));
  assert.equal(paths.includes("/dashboard/account"), false);
});
