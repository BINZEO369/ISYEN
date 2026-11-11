import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { SupabaseIntegration } from '../src/integrations/supabase.js';
import { resources } from '../src/routes/resources.js';

const config = loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
const profileInput = {
  first_name: 'Ayesha',
  last_name: 'Rahman',
  full_name: 'Ayesha Rahman',
  profile_photo: 'https://example.com/avatar.jpg',
  date_of_birth: '1995-06-10',
  gender: 'Prefer not to say',
  phone_number: '+8801712345678',
  bio: 'Smart-home enthusiast',
  country: 'Bangladesh',
  state: 'Dhaka Division',
  city: 'Dhaka',
  postal_code: '1207',
  address_line_1: '12 Example Road',
  address_line_2: null,
  latitude: 23.75,
  longitude: 90.39,
  language: 'bn',
  currency: 'BDT',
  timezone: 'Asia/Dhaka',
  date_format: 'YYYY-MM-DD',
  time_format: '24h',
  temperature_unit: 'celsius',
  theme: 'system',
  push_notifications: true,
  email_notifications: true,
  sms_notifications: false,
  security_alerts: true,
  device_alerts: true,
  automation_alerts: true,
};

function testIntegration(options: { service?: boolean; insertError?: { code: string } | null; authError?: { code: string; status: number } | null } = {}) {
  const captured: { authAttributes?: Record<string, unknown>; inserted?: Record<string, unknown>; deleted: string[] } = { deleted: [] };
  const authUserId = '33333333-3333-4333-8333-333333333333';
  const service = {
    auth: {
      admin: {
        createUser: async (attributes: Record<string, unknown>) => {
          captured.authAttributes = attributes;
          if (options.authError) return { data: { user: null }, error: options.authError };
          return { data: { user: { id: authUserId, email: attributes.email } }, error: null };
        },
        deleteUser: async (id: string) => { captured.deleted.push(id); return { data: { user: null }, error: null }; },
      },
    },
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        assert.equal(table, 'user_profiles');
        captured.inserted = row;
        return {
          select: () => ({
            single: async () => options.insertError
              ? { data: null, error: options.insertError }
              : { data: { id: '44444444-4444-4444-8444-444444444444', email: row.email, profile_status: row.profile_status, profile_completion: row.profile_completion, created_at: '2026-11-11T00:00:00.000Z' }, error: null },
          }),
        };
      },
    }),
  } as unknown as SupabaseClient;
  const integration: SupabaseIntegration = {
    configured: true,
    publicClient: {} as SupabaseClient,
    serviceClient: options.service === false ? undefined : service,
    requestClient: () => undefined,
    checkReadiness: async () => true,
    resolveTenant: async () => null,
  };
  return { integration, captured, authUserId };
}

const requestBody = { email: 'Ayesha@example.com', password: 'StrongPass!23', profile: profileInput };

test('registration creates a confirmed auth user, generated tenant metadata and one profile row', async () => {
  const { integration, captured, authUserId } = testIntegration();
  const app = buildApp(config, integration);
  try {
    assert.deepEqual(Object.keys(profileInput).sort(), Object.keys(resources.user_profiles.writable).sort(), 'signup persists every active user-editable profile column');
    const response = await app.inject({ method: 'POST', url: '/auth/register', payload: requestBody });
    assert.equal(response.statusCode, 201);
    assert.equal(response.json().data.verification_required, false);
    assert.equal(response.json().data.id, '44444444-4444-4444-8444-444444444444');
    assert.equal(response.json().data.email, 'ayesha@example.com');
    assert.equal(response.json().data.profile_status, 'active');

    assert.equal(captured.authAttributes?.email_confirm, true);
    assert.equal(captured.authAttributes?.email, 'ayesha@example.com');
    const metadata = captured.authAttributes?.app_metadata as Record<string, unknown>;
    const isyenId = String(metadata.isyen_id);
    assert.match(isyenId, /^[0-9a-f-]{36}$/i);
    assert.equal(captured.inserted?.auth_user_id, authUserId);
    assert.equal(captured.inserted?.isyen_id, isyenId);
    assert.equal(captured.inserted?.email, 'ayesha@example.com');
    assert.equal(captured.inserted?.id, undefined, 'PostgreSQL generates the profile primary key');
    assert.equal(captured.inserted?.created_at, undefined, 'PostgreSQL generates timestamps');
    for (const key of Object.keys(profileInput)) assert.ok(Object.hasOwn(captured.inserted ?? {}, key), `profile column ${key} is persisted`);
    assert.ok(!JSON.stringify(response.json()).includes('StrongPass'));
  } finally {
    await app.close();
  }
});

test('registration rejects malformed profile values before creating an auth user', async () => {
  const { integration, captured } = testIntegration();
  const app = buildApp(config, integration);
  try {
    const response = await app.inject({ method: 'POST', url: '/auth/register', payload: {
      ...requestBody,
      profile: { ...profileInput, latitude: 190 },
    } });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, 'INVALID_REGISTRATION');
    assert.equal(captured.authAttributes, undefined);
  } finally {
    await app.close();
  }
});

test('registration reports an existing email without revealing Auth internals', async () => {
  const { integration } = testIntegration({ authError: { code: 'email_exists', status: 422 } });
  const app = buildApp(config, integration);
  try {
    const response = await app.inject({ method: 'POST', url: '/auth/register', payload: requestBody });
    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error.code, 'EMAIL_ALREADY_REGISTERED');
    assert.ok(!JSON.stringify(response.json()).includes('email_exists'));
  } finally {
    await app.close();
  }
});

test('registration removes the Auth user if the profile insert fails', async () => {
  const { integration, captured, authUserId } = testIntegration({ insertError: { code: 'XX000' } });
  const app = buildApp(config, integration);
  try {
    const response = await app.inject({ method: 'POST', url: '/auth/register', payload: requestBody });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error.code, 'PROFILE_CREATE_FAILED');
    assert.deepEqual(captured.deleted, [authUserId]);
  } finally {
    await app.close();
  }
});

test('registration requires its server-only service client', async () => {
  const { integration, captured } = testIntegration({ service: false });
  const app = buildApp(config, integration);
  try {
    const response = await app.inject({ method: 'POST', url: '/auth/register', payload: requestBody });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error.code, 'REGISTRATION_NOT_CONFIGURED');
    assert.equal(captured.authAttributes, undefined);
  } finally {
    await app.close();
  }
});
