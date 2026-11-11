import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { SupabaseIntegration } from '../src/integrations/supabase.js';
import { resourceNames } from '../src/routes/resources.js';

const quietConfig = () => loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });

function fakeIntegration(calls: Array<{ method: string; args: unknown[] }> = []): SupabaseIntegration {
  const result = {
    data: [{ id: 'profile-1', full_name: 'Test User', metadata: { theme: 'dark', api_token: 'must-not-leak' } }],
    error: null,
    count: 1,
  };
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'order', 'range', 'limit', 'update', 'insert', 'delete']) {
    query[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return query;
    };
  }
  query.maybeSingle = async () => ({ data: result.data[0], error: null });
  query.single = async () => ({ data: result.data[0], error: null });
  query.then = (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  const client = { from: (table: string) => { calls.push({ method: 'from', args: [table] }); return query; } } as unknown as SupabaseClient;
  return {
    configured: true,
    publicClient: {} as SupabaseClient,
    requestClient: () => client,
    checkReadiness: async () => true,
    resolveTenant: async () => ({ authUserId: 'auth-user-1', isyenId: 'tenant-1' }),
  };
}

test('root and common health probe paths return HTTP 200 without database credentials', async () => {
  const app = buildApp(quietConfig());
  try {
    for (const url of ['/', '/health', '/healthz']) {
      const response = await app.inject({ method: 'GET', url });
      assert.equal(response.statusCode, 200, `${url} should return 200`);
      assert.equal(response.json().status, 'ok');
      assert.equal(response.json().service, '@isyen/server');
    }
  } finally {
    await app.close();
  }
});

test('readiness correctly reports missing Supabase configuration as 503', async () => {
  const app = buildApp(quietConfig());
  try {
    const response = await app.inject({ method: 'GET', url: '/ready' });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().reason, 'supabase_not_configured');
  } finally {
    await app.close();
  }
});

test('readiness returns 200 when the Supabase Auth endpoint is reachable', async () => {
  const app = buildApp(quietConfig(), fakeIntegration());
  try {
    const response = await app.inject({ method: 'GET', url: '/ready' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().status, 'ready');
  } finally {
    await app.close();
  }
});

test('API index lists all schema-backed resources without returning data', async () => {
  const app = buildApp(quietConfig());
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().resources, resourceNames);
    assert.equal(response.json().endpoints.length, 5);
  } finally {
    await app.close();
  }
});

test('every schema resource route requires a verified Bearer token', async () => {
  const app = buildApp(quietConfig());
  try {
    for (const resource of resourceNames) {
      const response = await app.inject({ method: 'GET', url: `/api/v1/${resource}` });
      assert.equal(response.statusCode, 401, `${resource} must require authentication`);
      assert.equal(response.json().error.code, 'AUTH_REQUIRED');
    }
  } finally {
    await app.close();
  }
});

test('unknown resources return 404 without disclosing database information', async () => {
  const app = buildApp(quietConfig());
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/not_a_table' });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, 'RESOURCE_NOT_FOUND');
  } finally {
    await app.close();
  }
});

test('user profile list is filtered to the authenticated profile and tenant', async () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const app = buildApp(quietConfig(), fakeIntegration(calls));
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/user_profiles',
      headers: { authorization: 'Bearer test-access-token' },
    });
    assert.equal(response.statusCode, 200);
    assert.ok(calls.some((call) => call.method === 'eq' && call.args[0] === 'auth_user_id' && call.args[1] === 'auth-user-1'));
    assert.ok(calls.some((call) => call.method === 'eq' && call.args[0] === 'isyen_id' && call.args[1] === 'tenant-1'));
    assert.ok(calls.some((call) => call.method === 'select' && String(call.args[0]).includes('full_name')));
    assert.ok(!String(calls.find((call) => call.method === 'select')?.args[0]).includes('isyen_id'));
    assert.ok(!JSON.stringify(response.json()).includes('api_token'));
  } finally {
    await app.close();
  }
});

test('request bodies cannot modify protected profile fields or inject JSON credentials', async () => {
  const app = buildApp(quietConfig(), fakeIntegration());
  try {
    const profile = await app.inject({
      method: 'PATCH',
      url: '/api/v1/user_profiles/11111111-1111-4111-8111-111111111111',
      headers: { authorization: 'Bearer test-access-token' },
      payload: { auth_user_id: 'another-user' },
    });
    assert.equal(profile.statusCode, 400);

    const home = await app.inject({
      method: 'PATCH',
      url: '/api/v1/homes/11111111-1111-4111-8111-111111111111',
      headers: { authorization: 'Bearer test-access-token' },
      payload: { metadata: { wifi_password: 'must-not-be-stored' } },
    });
    assert.equal(home.statusCode, 400);
  } finally {
    await app.close();
  }
});

test('user profile creation remains backend-managed', async () => {
  const app = buildApp(quietConfig(), fakeIntegration());
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/user_profiles',
      headers: { authorization: 'Bearer test-access-token' },
      payload: { full_name: 'Must not create a profile' },
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, 'WRITE_NOT_ALLOWED');
  } finally {
    await app.close();
  }
});
