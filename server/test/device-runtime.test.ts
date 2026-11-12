import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { SupabaseIntegration } from '../src/integrations/supabase.js';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
const tenant = { authUserId: 'auth-user-1', isyenId: 'tenant-owner-1' };
const homeId = '11111111-1111-4111-8111-111111111111';
const deviceId = '22222222-2222-4222-8222-222222222222';
const sensorConfig = { hardware: 'esp32_s3_gpio_sensor', gpio: 4, input_mode: 'analog', metric: 'soil_moisture', unit: '%', sample_interval_ms: 5000, pull_mode: 'none', enabled: true };

function fakeIntegration(client: Record<string, unknown>): SupabaseIntegration {
  return {
    configured: true,
    publicClient: {} as SupabaseClient,
    requestClient: () => client as unknown as SupabaseClient,
    checkReadiness: async () => true,
    resolveTenant: async (token) => token === 'valid-token' ? tenant : null,
  };
}

function fakeClient(options: { sensorConfig?: Record<string, unknown>; latest?: unknown[]; rows?: unknown[]; calls?: Array<{ name: string; args: Record<string, unknown> }> } = {}) {
  const calls = options.calls ?? [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'or', 'update', 'order', 'range']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ name: `query.${method}`, args: { args } });
      return builder;
    };
  }
  builder.maybeSingle = async () => ({ data: { id: deviceId, config: options.sensorConfig ?? sensorConfig }, error: null });
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve({ data: options.rows ?? null, error: null, count: options.rows?.length ?? null }).then(resolve, reject);
  const client: Record<string, unknown> = {
    from: (table: string) => {
      calls.push({ name: 'from', args: { table } });
      return builder;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === 'latest_sensor_readings') return { data: options.latest ?? [], error: null };
      return { data: [{ id: 'reading-1', device_id: deviceId, metric: 'soil_moisture', value_numeric: 2412, value_text: null, unit: '%', recorded_at: '2026-11-12T04:00:00.000Z' }], error: null };
    },
  };
  return { client, calls };
}

test('sensor runtime endpoints require a verified bearer token', async () => {
  const app = buildApp(config);
  try {
    for (const request of [
      { method: 'GET' as const, url: '/api/v1/device-runtime/sensors' },
      { method: 'GET' as const, url: `/api/v1/device-runtime/sensor-readings/latest?home_id=${homeId}` },
      { method: 'POST' as const, url: `/api/v1/device-runtime/${deviceId}/readings`, payload: { value: 1 } },
      { method: 'POST' as const, url: `/api/v1/device-runtime/${deviceId}/protocol-readings`, payload: { values: { temperature: 22.5, humidity: 48 } } },
    ]) {
      const response = await app.inject(request);
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().error.code, 'AUTH_REQUIRED');
    }
  } finally {
    await app.close();
  }
});

test('latest sensor readings forward only a selected home under the resolved tenant JWT', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const { client } = fakeClient({ calls, latest: [{ id: 'reading-1', home_id: homeId, device_id: deviceId, metric: 'soil_moisture', value_numeric: 2400, value_text: null, unit: '%', recorded_at: '2026-11-12T04:00:00.000Z' }] });
  const app = buildApp(config, fakeIntegration(client));
  try {
    const response = await app.inject({ method: 'GET', url: `/api/v1/device-runtime/sensor-readings/latest?home_id=${homeId}`, headers: { authorization: 'Bearer valid-token' } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data[0].metric, 'soil_moisture');
    assert.deepEqual(calls.find((call) => call.name === 'latest_sensor_readings')?.args, { p_home_id: homeId, p_limit: 500 });
  } finally {
    await app.close();
  }
});

test('sensor telemetry derives tenant/device config in the server and rejects out-of-range analog values', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const { client } = fakeClient({ calls });
  const app = buildApp(config, fakeIntegration(client));
  try {
    const valid = await app.inject({
      method: 'POST',
      url: `/api/v1/device-runtime/${deviceId}/readings`,
      headers: { authorization: 'Bearer valid-token' },
      payload: { value: 2412, reported_at: '2026-11-12T04:00:00.000Z' },
    });
    assert.equal(valid.statusCode, 201);
    const rpc = calls.find((call) => call.name === 'record_sensor_reading');
    assert.deepEqual(rpc?.args, { p_device_id: deviceId, p_value_numeric: 2412, p_reported_at: '2026-11-12T04:00:00.000Z' });
    assert.equal(Object.hasOwn(rpc?.args ?? {}, 'isyen_id'), false);
    assert.equal(Object.hasOwn(rpc?.args ?? {}, 'metric'), false);

    const invalid = await app.inject({
      method: 'POST',
      url: `/api/v1/device-runtime/${deviceId}/readings`,
      headers: { authorization: 'Bearer valid-token' },
      payload: { value: 4096 },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error.code, 'INVALID_SENSOR_READING');
    assert.equal(calls.filter((call) => call.name === 'record_sensor_reading').length, 1);
  } finally {
    await app.close();
  }
});


test('DHT/BMP protocol telemetry stores multiple allowed metrics through a tenant-scoped RPC', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const protocolConfig = { hardware: 'isyen_protocol_sensor', sensor_key: 'dht22_temperature_humidity', connection: 'gpio', data_gpio: 4, sampling_interval_seconds: 10, temperature_unit: 'celsius', enabled: true };
  const { client } = fakeClient({ calls, sensorConfig: protocolConfig });
  const app = buildApp(config, fakeIntegration(client));
  try {
    const response = await app.inject({ method: 'POST', url: `/api/v1/device-runtime/${deviceId}/protocol-readings`, headers: { authorization: 'Bearer valid-token' }, payload: { values: { temperature: 22.5, humidity: 48 }, reported_at: '2026-11-12T04:00:00.000Z' } });
    assert.equal(response.statusCode, 201);
    assert.deepEqual(calls.find((call) => call.name === 'record_protocol_sensor_readings')?.args, { p_device_id: deviceId, p_values: { temperature: 22.5, humidity: 48 }, p_reported_at: '2026-11-12T04:00:00.000Z' });
    assert.equal(Object.hasOwn(calls.find((call) => call.name === 'record_protocol_sensor_readings')?.args ?? {}, 'isyen_id'), false);
    const invalid = await app.inject({ method: 'POST', url: `/api/v1/device-runtime/${deviceId}/protocol-readings`, headers: { authorization: 'Bearer valid-token' }, payload: { values: { pressure: 1000 } } });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error.code, 'INVALID_SENSOR_READING');
    assert.equal(calls.filter((call) => call.name === 'record_protocol_sensor_readings').length, 1);
  } finally { await app.close(); }
});

test('sensor inventory is tenant-filtered and does not expose the internal tenant identifier', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const row = { id: deviceId, home_id: homeId, room_id: null, name: 'Soil sensor', config: sensorConfig, status: 'online', last_seen_at: '2026-11-12T04:00:00.000Z', created_at: '2026-11-12T03:00:00.000Z' };
  const { client } = fakeClient({ calls, rows: [row] });
  const app = buildApp(config, fakeIntegration(client));
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/device-runtime/sensors?limit=100&offset=0', headers: { authorization: 'Bearer valid-token' } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data, [row]);
    assert.equal(Object.hasOwn(response.json().data[0], 'isyen_id'), false);
    assert.equal(calls.some((call) => call.name === 'query.eq' && JSON.stringify(call.args.args) === JSON.stringify(['isyen_id', tenant.isyenId])), true);
    assert.equal(calls.some((call) => call.name === 'query.or' && String(call.args.args).includes('isyen_protocol_sensor')), true);
  } finally {
    await app.close();
  }
});


test('ESP32 gateway heartbeat registers a board per tenant and accumulates request sequences', async () => {
  const gatewayId = '33333333-3333-4333-8333-333333333333';
  let stored: Record<string, unknown> | null = null;
  let pending: Record<string, unknown> | null = null;
  const client: Record<string, unknown> = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.order = () => builder;
      builder.limit = () => builder;
      builder.maybeSingle = async () => table === 'homes'
        ? { data: { id: homeId }, error: null }
        : { data: stored, error: null };
      builder.insert = (values: Record<string, unknown>) => { pending = { ...values, id: gatewayId }; return builder; };
      builder.update = (values: Record<string, unknown>) => { pending = { ...(stored ?? {}), ...values }; return builder; };
      builder.single = async () => {
        stored = pending;
        return { data: stored, error: null };
      };
      return builder;
    },
  };
  const app = buildApp(config, fakeIntegration(client));
  const heartbeat = (sequence: number) => app.inject({
    method: 'POST',
    url: '/api/v1/device-runtime/gateways/heartbeat',
    headers: { authorization: 'Bearer valid-token' },
    payload: { serial_number: 'aabbccddeeff', boot_id: 'boot-1', request_sequence: sequence, firmware_version: '4.1.0', wifi_rssi: -54 },
  });
  try {
    const first = await heartbeat(10);
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().data.serial_number, 'AABBCCDDEEFF');
    assert.equal(first.json().data.metadata.requests_total, 10);
    assert.equal(stored?.isyen_id, tenant.isyenId);

    const second = await heartbeat(15);
    assert.equal(second.statusCode, 200);
    assert.equal(second.json().data.metadata.requests_total, 15);
    assert.equal(second.json().data.metadata.request_sequence, 15);
  } finally {
    await app.close();
  }
});

test('ESP32 gateway heartbeat rejects malformed serials and unauthenticated callers', async () => {
  const app = buildApp(config, fakeIntegration({}));
  try {
    const invalid = await app.inject({ method: 'POST', url: '/api/v1/device-runtime/gateways/heartbeat', headers: { authorization: 'Bearer valid-token' }, payload: { serial_number: 'not-a-mac', boot_id: 'b1', request_sequence: 2, firmware_version: '4.1.0' } });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error.code, 'INVALID_GATEWAY_HEARTBEAT');
    const unauthenticated = await app.inject({ method: 'POST', url: '/api/v1/device-runtime/gateways/heartbeat', payload: { serial_number: 'AABBCCDDEEFF', boot_id: 'b1', request_sequence: 2, firmware_version: '4.1.0' } });
    assert.equal(unauthenticated.statusCode, 401);
  } finally {
    await app.close();
  }
});


test('gateway status returns tenant-scoped board counts and server-computed live state', async () => {
  const calls: Array<{ table: string; args: unknown[] }> = [];
  const board = { id: '44444444-4444-4444-8444-444444444444', home_id: homeId, name: 'ESP32-S3 EEFF', gateway_type: 'esp32_s3_n16r8', serial_number: 'AABBCCDDEEFF', status: 'online', last_seen_at: new Date().toISOString(), metadata: { requests_total: 12, requests_per_minute: 4 } };
  const client: Record<string, unknown> = {
    from: (table: string) => {
      const state = { head: false, online: false };
      const builder: Record<string, unknown> = {};
      builder.select = (...args: unknown[]) => { calls.push({ table, args }); state.head = Boolean((args[1] as { head?: boolean } | undefined)?.head); return builder; };
      builder.eq = (...args: unknown[]) => { calls.push({ table, args }); return builder; };
      builder.gte = (...args: unknown[]) => { calls.push({ table, args }); state.online = true; return builder; };
      builder.order = () => builder;
      builder.range = () => builder;
      builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve({
        data: state.head ? null : [board],
        error: null,
        count: state.head ? (state.online ? 2 : 3) : 1,
      }).then(resolve, reject);
      return builder;
    },
  };
  const app = buildApp(config, fakeIntegration(client));
  try {
    const response = await app.inject({ method: 'GET', url: '/api/v1/device-runtime/gateways/status?limit=1&offset=0', headers: { authorization: 'Bearer valid-token' } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().summary, { total: 3, online: 2, offline: 1 });
    assert.equal(response.json().data[0].is_online, true);
    assert.equal(response.json().online_threshold_seconds, 45);
    assert.equal(calls.some((call) => call.args[0] === 'isyen_id' && call.args[1] === tenant.isyenId), true);
    assert.equal(calls.some((call) => call.args[0] === 'gateway_type' && call.args[1] === 'esp32_s3_n16r8'), true);
  } finally {
    await app.close();
  }
});
