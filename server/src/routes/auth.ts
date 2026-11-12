import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SupabaseIntegration } from '../integrations/supabase.js';

const nullableText = z.string().trim().max(4_000).nullable().default(null);
const dateOfBirth = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}).nullable().default(null);

const registrationSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(72),
  profile: z.object({
    first_name: z.string().trim().min(1).max(120),
    last_name: z.string().trim().min(1).max(120),
    full_name: nullableText,
    profile_photo: nullableText,
    date_of_birth: dateOfBirth,
    gender: nullableText,
    phone_number: nullableText,
    bio: nullableText,
    country: nullableText,
    state: nullableText,
    city: nullableText,
    postal_code: nullableText,
    address_line_1: nullableText,
    address_line_2: nullableText,
    latitude: z.number().finite().min(-90).max(90).nullable().default(null),
    longitude: z.number().finite().min(-180).max(180).nullable().default(null),
    language: z.string().trim().min(2).max(20).default('bn'),
    currency: z.string().trim().min(3).max(8).default('BDT'),
    timezone: z.string().trim().min(1).max(100).default('Asia/Dhaka'),
    date_format: z.string().trim().min(1).max(40).default('YYYY-MM-DD'),
    time_format: z.enum(['12h', '24h']).default('24h'),
    temperature_unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    push_notifications: z.boolean().default(true),
    email_notifications: z.boolean().default(true),
    sms_notifications: z.boolean().default(false),
    security_alerts: z.boolean().default(true),
    device_alerts: z.boolean().default(true),
    automation_alerts: z.boolean().default(true),
  }).strict(),
}).strict();

function errorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'unknown';
  return String((error as { code?: unknown }).code ?? 'unknown');
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) return undefined;
  const status = Number((error as { status?: unknown }).status);
  return Number.isInteger(status) ? status : undefined;
}

function isEmailConflict(error: unknown): boolean {
  return ['email_exists', 'user_already_exists', '23505'].includes(errorCode(error));
}

/** Registration is the only public path allowed to create an auth/profile pair. */
export function registerAuthRoutes(app: FastifyInstance, integration: SupabaseIntegration): void {
  app.post('/auth/register', async (request, reply) => {
    const parsed = registrationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'INVALID_REGISTRATION', message: 'Check the required fields and submitted values.' } });
    }
    const service = integration.serviceClient;
    if (!service) {
      return reply.code(503).send({ error: { code: 'REGISTRATION_NOT_CONFIGURED', message: 'Account registration is not configured.' } });
    }

    const email = parsed.data.email.toLowerCase();
    const isyenId = randomUUID();
    const profileInput = parsed.data.profile;
    const fullName = profileInput.full_name?.trim() || `${profileInput.first_name} ${profileInput.last_name}`.trim();
    const completionValues = [
      profileInput.first_name, profileInput.last_name, profileInput.profile_photo, profileInput.date_of_birth,
      profileInput.gender, profileInput.phone_number, profileInput.bio, profileInput.country, profileInput.state,
      profileInput.city, profileInput.postal_code, profileInput.address_line_1, profileInput.address_line_2,
      profileInput.latitude, profileInput.longitude,
    ];
    const profileCompletion = Math.round((completionValues.filter((value) => value !== null && value !== '').length / completionValues.length) * 100);
    const profileStatus = 'active';

    let authUserId: string | undefined;
    try {
      const { data: authData, error: authError } = await service.auth.admin.createUser({
        email,
        password: parsed.data.password,
        // Explicitly skip email verification for the requested MVP flow.
        email_confirm: true,
        app_metadata: { isyen_id: isyenId },
        user_metadata: { full_name: fullName },
      });
      if (authError || !authData.user) {
        if (authError && isEmailConflict(authError)) {
          return reply.code(409).send({ error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'An account already exists for this email.' } });
        }
        request.log.warn({ authCode: errorCode(authError), authStatus: errorStatus(authError) }, 'Registration auth user creation failed');
        return reply.code(authError && errorStatus(authError) === 422 ? 400 : 503)
          .send({ error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'The account could not be created right now.' } });
      }
      authUserId = authData.user.id;

      const { data: profile, error: profileError } = await service
        .from('user_profiles')
        .insert({
          ...profileInput,
          full_name: fullName,
          email,
          auth_user_id: authUserId,
          isyen_id: isyenId,
          profile_status: profileStatus,
          profile_completion: profileCompletion,
        })
        .select('id,email,profile_status,profile_completion,created_at')
        .single();

      if (profileError || !profile) {
        request.log.error({ databaseCode: errorCode(profileError) }, 'Registration profile creation failed');
        try {
          await service.auth.admin.deleteUser(authUserId);
        } catch {
          request.log.error({ operation: 'registration_user_cleanup' }, 'Failed to clean up auth user after profile insert failure');
        }
        if (profileError && isEmailConflict(profileError)) {
          return reply.code(409).send({ error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'An account already exists for this email.' } });
        }
        return reply.code(503).send({ error: { code: 'PROFILE_CREATE_FAILED', message: 'The profile could not be saved right now.' } });
      }

      return reply.code(201).send({
        data: {
          id: profile.id,
          email: profile.email,
          profile_status: profile.profile_status,
          profile_completion: profile.profile_completion,
          created_at: profile.created_at,
          verification_required: false,
        },
      });
    } catch {
      if (authUserId) {
        try {
          await service.auth.admin.deleteUser(authUserId);
        } catch {
          request.log.error({ operation: 'registration_user_cleanup' }, 'Failed to clean up auth user after unexpected error');
        }
      }
      request.log.error({ operation: 'registration' }, 'Unexpected registration failure');
      return reply.code(503).send({ error: { code: 'REGISTRATION_UNAVAILABLE', message: 'Registration is temporarily unavailable.' } });
    }
  });
}
