import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { SupabaseIntegration } from '../integrations/supabase.js';
import { isResourceName, isSafeEsp32S3OutputPin, isValidEsp32S3LightConfig, isValidEsp32S3SensorConfig, resourceNames, resources, type FieldRule, type ResourceName } from './resources.js';

const idParams = z.object({ resource: z.string(), id: z.string().uuid() });
const resourceParams = z.object({ resource: z.string() });
const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  order_by: z.string().min(1).max(64).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
}).passthrough();
const sensorInventoryQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  home_id: z.string().uuid().optional(),
}).strict();
const sensorMeasurementBody = z.object({
  value: z.union([z.number().finite(), z.boolean()]),
  reported_at: z.string().datetime({ offset: true }).optional(),
}).strict();

type Tenant = { authUserId: string; isyenId: string };
type RequestWithAuth = FastifyRequest & { tenant?: Tenant; accessToken?: string };

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function errorResponse(reply: FastifyReply, statusCode: number, code: string, message: string) {
  return reply.code(statusCode).send({ error: { code, message } });
}

function schemaFor(rule: FieldRule, queryValue = false): z.ZodTypeAny {
  switch (rule) {
    case 'text': return z.string().trim().min(1).max(4_000);
    case 'requiredText': return z.string().trim().min(1).max(500);
    case 'nullableText': return z.string().trim().max(4_000).nullable();
    case 'uuid': return z.string().uuid();
    case 'nullableUuid': return z.string().uuid().nullable();
    case 'integer': return queryValue ? z.coerce.number().int() : z.number().int();
    case 'nullableInteger': return (queryValue ? z.coerce.number().int() : z.number().int()).nullable();
    case 'number': return queryValue ? z.coerce.number().finite() : z.number().finite();
    case 'nullableNumber': return (queryValue ? z.coerce.number().finite() : z.number().finite()).nullable();
    case 'boolean': return queryValue
      ? z.union([z.literal('true'), z.literal('false')]).transform((value) => value === 'true')
      : z.boolean();
    case 'object': return z.record(z.unknown());
    case 'homeStatus': return z.enum(['active', 'inactive', 'archived']);
    case 'gatewayStatus': return z.enum(['online', 'offline', 'degraded', 'provisioning']);
    case 'deviceStatus': return z.enum(['online', 'offline', 'unavailable', 'provisioning']);
    case 'integrationStatus': return z.enum(['pending', 'active', 'error', 'revoked']);
    case 'deviceTypeKey': return z.enum(['esp32_s3_gpio_light', 'esp32_s3_gpio_sensor']);
    case 'timeFormat': return z.enum(['12h', '24h']);
    case 'temperatureUnit': return z.enum(['celsius', 'fahrenheit']);
    case 'theme': return z.enum(['light', 'dark', 'system']);
    case 'deviceView': return z.enum(['grid', 'list', 'compact']);
    case 'date': return z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
    });
    case 'nullableDate': return z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
    }).nullable();
    case 'dateTime': return z.string().datetime({ offset: true });
    case 'nullableDateTime': return z.string().datetime({ offset: true }).nullable();
  }
}

const sensitiveFieldName = /(password|passwd|secret|token|api[_-]?key|private[_-]?key|credential|authorization|access[_-]?key)/i;

function containsSensitiveField(value: unknown, depth = 0): boolean {
  if (depth > 12) return true;
  if (Array.isArray(value)) return value.some((entry) => containsSensitiveField(entry, depth + 1));
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, entry]) => sensitiveFieldName.test(key) || containsSensitiveField(entry, depth + 1));
}

function redactSensitiveFields(value: unknown, depth = 0): unknown {
  if (depth > 12) return undefined;
  if (Array.isArray(value)) return value.map((entry) => redactSensitiveFields(entry, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !sensitiveFieldName.test(key))
    .map(([key, entry]) => [key, redactSensitiveFields(entry, depth + 1)]));
}

function parseBody(resource: ResourceName, input: unknown, mode: 'create' | 'update'):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; message: string } {
  const definition = resources[resource];
  const inputResult = z.record(z.unknown()).safeParse(input);
  if (!inputResult.success) return { ok: false, message: 'Request body must be a JSON object.' };
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(inputResult.data)) {
    if (mode === 'update' && key === 'device_type_key') return { ok: false, message: 'Field "device_type_key" is accepted only when creating a device.' };
    const rule = definition.writable[key];
    if (!rule) return { ok: false, message: `Field "${key}" is not writable for this resource.` };
    if (rule === 'object' && containsSensitiveField(value)) {
      return { ok: false, message: `Field "${key}" must not contain credentials or secret values.` };
    }
    const parsed = schemaFor(rule).safeParse(value);
    if (!parsed.success) return { ok: false, message: `Field "${key}" has an invalid value.` };
    body[key] = parsed.data;
  }
  if (mode === 'create') {
    const missing = definition.requiredOnCreate.filter((field) => body[field] === undefined);
    if (missing.length) return { ok: false, message: `Required fields are missing: ${missing.join(', ')}.` };
  } else if (!Object.keys(body).length) {
    return { ok: false, message: 'At least one writable field is required.' };
  }
  if (resource === 'schedules' && mode === 'create' && !body.automation_id && !body.scene_id) {
    return { ok: false, message: 'A schedule must reference an automation_id or scene_id.' };
  }
  if (resource === 'devices') {
    if (mode === 'create' && Boolean(body.device_type_id) === Boolean(body.device_type_key)) {
      return { ok: false, message: 'Provide exactly one of device_type_id or device_type_key.' };
    }
    const config = body.config as Record<string, unknown> | undefined;
    if ((body.device_type_key === 'esp32_s3_gpio_light' || config?.hardware === 'esp32_s3_gpio_light') && !isValidEsp32S3LightConfig(config)) {
      return { ok: false, message: 'GPIO light config must use a supported ESP32-S3 output pin and a boolean desired_on value.' };
    }
    if ((body.device_type_key === 'esp32_s3_gpio_sensor' || config?.hardware === 'esp32_s3_gpio_sensor') && !isValidEsp32S3SensorConfig(config)) {
      return { ok: false, message: 'GPIO sensor config must use a supported ESP32-S3 input pin, mode, metric and sample interval.' };
    }
    if (mode === 'create' && (config?.hardware === 'esp32_s3_gpio_light' || config?.hardware === 'esp32_s3_gpio_sensor') && body.device_type_key !== config.hardware) {
      return { ok: false, message: 'The GPIO device type key must match its hardware configuration.' };
    }
  }
  return { ok: true, value: body };
}

function parseFilters(resource: ResourceName, rawQuery: unknown):
  | { ok: true; filters: Record<string, string | number | boolean> }
  | { ok: false; message: string } {
  if (!rawQuery || typeof rawQuery !== 'object' || Array.isArray(rawQuery)) {
    return { ok: false, message: 'Query parameters are invalid.' };
  }
  const input = rawQuery as Record<string, unknown>;
  const definition = resources[resource];
  const allowedKeys = new Set(['limit', 'offset', 'order_by', 'order', ...Object.keys(definition.filters)]);
  const unsupported = Object.keys(input).find((key) => !allowedKeys.has(key));
  if (unsupported) return { ok: false, message: `Query parameter "${unsupported}" is not supported for this resource.` };
  const paging = paginationQuery.safeParse({ limit: input.limit, offset: input.offset, order_by: input.order_by, order: input.order });
  if (!paging.success) return { ok: false, message: 'Pagination or ordering parameters are invalid.' };
  const orderBy = paging.data.order_by ?? definition.defaultOrderBy;
  if (!definition.orderBy.includes(orderBy)) return { ok: false, message: 'The requested order_by field is not supported for this resource.' };
  const filters: Record<string, string | number | boolean> = {};
  for (const [key, rule] of Object.entries(definition.filters)) {
    if (input[key] === undefined) continue;
    const parsed = schemaFor(rule, true).safeParse(input[key]);
    if (!parsed.success) return { ok: false, message: `Filter "${key}" has an invalid value.` };
    filters[key] = parsed.data as string | number | boolean;
  }
  return { ok: true, filters };
}

function databaseErrorStatus(error: { code?: string }): number {
  if (error.code === '23505') return 409;
  if (error.code === '23503' || error.code === '23514') return 422;
  if (error.code === '22P02' || error.code === '22001') return 400;
  return 503;
}

function reportDatabaseError(request: FastifyRequest, reply: FastifyReply, operation: string, error: { code?: string }) {
  request.log.warn({ databaseCode: error.code ?? 'unknown', operation }, 'Supabase request failed');
  const statusCode = databaseErrorStatus(error);
  const code = statusCode === 409 ? 'CONFLICT' : statusCode === 422 ? 'INVALID_REFERENCE' : statusCode === 400 ? 'INVALID_VALUE' : 'DATABASE_UNAVAILABLE';
  const message = statusCode === 409
    ? 'A resource with the same unique value already exists.'
    : statusCode === 422
      ? 'A referenced resource or value is invalid.'
      : statusCode === 400
        ? 'A field value is invalid.'
        : 'The database request could not be completed.';
  return errorResponse(reply, statusCode, code, message);
}

async function requireTenant(request: RequestWithAuth, reply: FastifyReply, integration: SupabaseIntegration): Promise<Tenant | null> {
  const token = bearerToken(request);
  if (!token) {
    errorResponse(reply, 401, 'AUTH_REQUIRED', 'A valid Bearer access token is required.');
    return null;
  }
  if (!integration.configured || !integration.publicClient) {
    errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase server integration is not configured.');
    return null;
  }
  try {
    const tenant = await integration.resolveTenant(token);
    if (!tenant) {
      errorResponse(reply, 401, 'TENANT_NOT_RESOLVED', 'The authenticated user has no active ISYEN profile.');
      return null;
    }
    request.accessToken = token;
    request.tenant = tenant;
    return tenant;
  } catch {
    errorResponse(reply, 503, 'AUTH_PROVIDER_UNAVAILABLE', 'Authentication could not be verified right now.');
    return null;
  }
}

function scopedQuery<T>(query: T, resource: ResourceName, tenant: Tenant): T {
  const definition = resources[resource];
  let scoped = query;
  if (!definition.shared) scoped = (scoped as { eq(column: string, value: string): T }).eq('isyen_id', tenant.isyenId);
  if (definition.selfOnly) scoped = (scoped as { eq(column: string, value: string): T }).eq('auth_user_id', tenant.authUserId);
  return scoped;
}

function requestClient(resource: ResourceName, request: RequestWithAuth, integration: SupabaseIntegration) {
  if (!integration.configured) return undefined;
  // Every user and shared-table query uses the caller JWT so PostgreSQL RLS remains active.
  return integration.requestClient(request.accessToken ?? '');
}

async function resolveGpioDeviceTypeId(key: 'esp32_s3_gpio_light' | 'esp32_s3_gpio_sensor', request: RequestWithAuth, reply: FastifyReply, integration: SupabaseIntegration): Promise<string | null> {
  const userClient = requestClient('device_types', request, integration);
  if (!userClient) {
    errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');
    return null;
  }
  const existing = await userClient.from('device_types').select('id').eq('key', key).eq('is_active', true).maybeSingle();
  if (existing.error) {
    reportDatabaseError(request, reply, 'device_type_lookup', existing.error);
    return null;
  }
  if (existing.data?.id) return String(existing.data.id);

  // This is a shared, idempotent catalog bootstrap only; tenant-owned data remains caller-JWT/RLS scoped.
  const service = integration.serviceClient;
  if (!service) {
    errorResponse(reply, 503, 'DEVICE_TYPE_NOT_CONFIGURED', 'The ESP32-S3 GPIO device type is not configured on the server.');
    return null;
  }
  const sensor = key === 'esp32_s3_gpio_sensor';
  const created = await service.from('device_types').upsert({
    key,
    name: sensor ? 'ESP32-S3 GPIO Sensor' : 'ESP32-S3 GPIO Light',
    category: sensor ? 'sensor' : 'lighting',
    manufacturer: 'ISYEN',
    capabilities: sensor ? { gpio_input: true, analog_input: true, digital_input: true, realtime_telemetry: true } : { switch: true, gpio_output: true },
    default_config: sensor ? { hardware: 'esp32_s3_gpio_sensor' } : { hardware: 'esp32_s3_gpio_light', gpio: 4, desired_on: false, active_low: false },
    is_active: true,
  }, { onConflict: 'key' }).select('id').single();
  if (created.error || !created.data?.id) {
    reportDatabaseError(request, reply, 'device_type_bootstrap', created.error ?? { code: 'unknown' });
    return null;
  }
  return String(created.data.id);
}

async function gpioAlreadyAssigned(
  client: NonNullable<ReturnType<typeof requestClient>>,
  isyenId: string,
  gpio: number,
  excludeDeviceId?: string,
): Promise<{ conflict: boolean; error?: unknown }> {
  for (let offset = 0; offset <= 1_000_000; offset += 1000) {
    const { data, error } = await client.from('devices')
      .select('id,config')
      .eq('isyen_id', isyenId)
      .range(offset, offset + 999);
    if (error) return { conflict: false, error };
    const conflict = (data ?? []).some((row) => {
      const config = row.config as Record<string, unknown> | null;
      return row.id !== excludeDeviceId
        && (config?.hardware === 'esp32_s3_gpio_light' || config?.hardware === 'esp32_s3_gpio_sensor')
        && config.gpio === gpio;
    });
    if (conflict) return { conflict: true };
    if (!data || data.length < 1000) return { conflict: false };
  }
  return { conflict: false };
}

export function registerDatabaseRoutes(app: FastifyInstance, integration: SupabaseIntegration): void {
  app.addHook('preHandler', async (request, reply) => {
    const routeResource = (request.params as { resource?: string } | undefined)?.resource;
    if (!routeResource || !isResourceName(routeResource)) return;
    const requestWithAuth = request as RequestWithAuth;
    const tenant = await requireTenant(requestWithAuth, reply, integration);
    if (!tenant) return reply;
  });

  app.get('/api/v1', async () => ({
    version: 'v1',
    authentication: 'Bearer Supabase access token required for resource endpoints',
    resources: resourceNames,
    endpoints: ['GET /api/v1/:resource', 'GET /api/v1/:resource/:id', 'POST /api/v1/:resource', 'PATCH /api/v1/:resource/:id', 'DELETE /api/v1/:resource/:id'],
  }));

  app.get('/api/v1/:resource', async (request, reply) => {
    const parsedParams = resourceParams.safeParse(request.params);
    if (!parsedParams.success || !isResourceName(parsedParams.data.resource)) {
      return errorResponse(reply, 404, 'RESOURCE_NOT_FOUND', 'Unknown database resource.');
    }
    const resource = parsedParams.data.resource;
    const parsedFilters = parseFilters(resource, request.query);
    if (!parsedFilters.ok) return errorResponse(reply, 400, 'INVALID_QUERY', parsedFilters.message);
    const requestWithAuth = request as RequestWithAuth;
    const tenant = requestWithAuth.tenant;
    const client = requestClient(resource, requestWithAuth, integration);
    if (!client || !tenant) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');

    const paging = paginationQuery.parse(request.query);
    const orderBy = paging.order_by ?? resources[resource].defaultOrderBy;
    let query = client.from(resource).select(resources[resource].select, { count: 'planned' });
    query = scopedQuery(query, resource, tenant);
    for (const [column, value] of Object.entries(parsedFilters.filters)) query = query.eq(column, value);
    query = query
      .order(orderBy, { ascending: paging.order === 'asc', nullsFirst: false })
      .range(paging.offset, paging.offset + paging.limit - 1);

    const { data, error, count } = await query;
    if (error) return reportDatabaseError(request, reply, 'list', error);
    return reply.send({
      data: redactSensitiveFields(data ?? []),
      pagination: {
        limit: paging.limit,
        offset: paging.offset,
        total: count ?? data?.length ?? 0,
        total_is_estimate: true,
        has_more: (data?.length ?? 0) === paging.limit,
      },
    });
  });

  app.get('/api/v1/:resource/:id', async (request, reply) => {
    const parsed = idParams.safeParse(request.params);
    if (!parsed.success || !isResourceName(parsed.data.resource)) {
      return errorResponse(reply, 404, 'RESOURCE_NOT_FOUND', 'Unknown database resource or invalid id.');
    }
    const resource = parsed.data.resource;
    const requestWithAuth = request as RequestWithAuth;
    const tenant = requestWithAuth.tenant;
    const client = requestClient(resource, requestWithAuth, integration);
    if (!client || !tenant) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');

    let query = client.from(resource).select(resources[resource].select).eq('id', parsed.data.id);
    query = scopedQuery(query, resource, tenant);
    const { data, error } = await query.maybeSingle();
    if (error) return reportDatabaseError(request, reply, 'get', error);
    if (!data) return errorResponse(reply, 404, 'NOT_FOUND', 'Resource row not found.');
    return reply.send({ data: redactSensitiveFields(data) });
  });

  app.post('/api/v1/:resource', async (request, reply) => {
    const parsed = resourceParams.safeParse(request.params);
    if (!parsed.success || !isResourceName(parsed.data.resource)) return errorResponse(reply, 404, 'RESOURCE_NOT_FOUND', 'Unknown database resource.');
    const resource = parsed.data.resource;
    const definition = resources[resource];
    if (!definition.write || definition.serviceOnly || definition.selfOnly) {
      return errorResponse(reply, 403, 'WRITE_NOT_ALLOWED', 'This resource cannot be created by a user API request.');
    }
    const body = parseBody(resource, request.body, 'create');
    if (!body.ok) return errorResponse(reply, 400, 'INVALID_BODY', body.message);
    const requestWithAuth = request as RequestWithAuth;
    const tenant = requestWithAuth.tenant;
    const client = requestClient(resource, requestWithAuth, integration);
    if (!client || !tenant) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');

    const insertBody = { ...body.value };
    if (resource === 'devices' && (insertBody.device_type_key === 'esp32_s3_gpio_light' || insertBody.device_type_key === 'esp32_s3_gpio_sensor')) {
      const typeId = await resolveGpioDeviceTypeId(insertBody.device_type_key, requestWithAuth, reply, integration);
      if (!typeId) return reply;
      delete insertBody.device_type_key;
      insertBody.device_type_id = typeId;
    }
    if (resource === 'devices' && (isValidEsp32S3LightConfig(insertBody.config) || isValidEsp32S3SensorConfig(insertBody.config))) {
      const pinCheck = await gpioAlreadyAssigned(client, tenant.isyenId, (insertBody.config as { gpio: number }).gpio);
      if (pinCheck.error) return reportDatabaseError(request, reply, 'gpio_conflict_lookup', pinCheck.error);
      if (pinCheck.conflict) return errorResponse(reply, 409, 'GPIO_ALREADY_ASSIGNED', 'This GPIO pin is already assigned to another light or sensor in this ISYEN account.');
    }

    const { data, error } = await client.from(resource)
      .insert({ ...insertBody, isyen_id: tenant.isyenId })
      .select(definition.select)
      .single();
    if (error?.code === '23505' && resource === 'devices' && (isValidEsp32S3LightConfig(insertBody.config) || isValidEsp32S3SensorConfig(insertBody.config))) {
      return errorResponse(reply, 409, 'GPIO_ALREADY_ASSIGNED', 'This GPIO pin is already assigned to another light or sensor in this ISYEN account.');
    }
    if (error) return reportDatabaseError(request, reply, 'insert', error);
    return reply.code(201).send({ data: redactSensitiveFields(data) });
  });

  app.patch('/api/v1/:resource/:id', async (request, reply) => {
    const parsed = idParams.safeParse(request.params);
    if (!parsed.success || !isResourceName(parsed.data.resource)) return errorResponse(reply, 404, 'RESOURCE_NOT_FOUND', 'Unknown database resource or invalid id.');
    const resource = parsed.data.resource;
    const definition = resources[resource];
    if (!definition.write || definition.serviceOnly) return errorResponse(reply, 403, 'WRITE_NOT_ALLOWED', 'This resource is read-only or service-managed.');
    const body = parseBody(resource, request.body, 'update');
    if (!body.ok) return errorResponse(reply, 400, 'INVALID_BODY', body.message);
    const requestWithAuth = request as RequestWithAuth;
    const tenant = requestWithAuth.tenant;
    const client = requestClient(resource, requestWithAuth, integration);
    if (!client || !tenant) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');

    if (resource === 'devices' && (isValidEsp32S3LightConfig(body.value.config) || isValidEsp32S3SensorConfig(body.value.config))) {
      const pinCheck = await gpioAlreadyAssigned(client, tenant.isyenId, (body.value.config as { gpio: number }).gpio, parsed.data.id);
      if (pinCheck.error) return reportDatabaseError(request, reply, 'gpio_conflict_lookup', pinCheck.error);
      if (pinCheck.conflict) return errorResponse(reply, 409, 'GPIO_ALREADY_ASSIGNED', 'This GPIO pin is already assigned to another light or sensor in this ISYEN account.');
    }

    let query = client.from(resource).update(body.value).eq('id', parsed.data.id);
    query = scopedQuery(query, resource, tenant);
    const { data, error } = await query.select(definition.select).maybeSingle();
    if (error?.code === '23505' && resource === 'devices' && (isValidEsp32S3LightConfig(body.value.config) || isValidEsp32S3SensorConfig(body.value.config))) {
      return errorResponse(reply, 409, 'GPIO_ALREADY_ASSIGNED', 'This GPIO pin is already assigned to another light or sensor in this ISYEN account.');
    }
    if (error) return reportDatabaseError(request, reply, 'update', error);
    if (!data) return errorResponse(reply, 404, 'NOT_FOUND', 'Resource row not found.');
    return reply.send({ data: redactSensitiveFields(data) });
  });

  app.delete('/api/v1/:resource/:id', async (request, reply) => {
    const parsed = idParams.safeParse(request.params);
    if (!parsed.success || !isResourceName(parsed.data.resource)) return errorResponse(reply, 404, 'RESOURCE_NOT_FOUND', 'Unknown database resource or invalid id.');
    const resource = parsed.data.resource;
    const definition = resources[resource];
    if (!definition.write || definition.serviceOnly || definition.selfOnly) {
      return errorResponse(reply, 403, 'DELETE_NOT_ALLOWED', 'This resource cannot be deleted by a user API request.');
    }
    const requestWithAuth = request as RequestWithAuth;
    const tenant = requestWithAuth.tenant;
    const client = requestClient(resource, requestWithAuth, integration);
    if (!client || !tenant) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');

    let query = client.from(resource).delete().eq('id', parsed.data.id);
    query = scopedQuery(query, resource, tenant);
    const { data, error } = await query.select('id').maybeSingle();
    if (error) return reportDatabaseError(request, reply, 'delete', error);
    if (!data) return errorResponse(reply, 404, 'NOT_FOUND', 'Resource row not found.');
    return reply.code(204).send();
  });

  app.get('/api/v1/device-runtime/identity', async (request, reply) => {
    const requestWithAuth = request as RequestWithAuth;
    const tenant = await requireTenant(requestWithAuth, reply, integration);
    if (!tenant) return reply;
    return reply.send({ data: { isyen_id: tenant.isyenId } });
  });

  app.get('/api/v1/device-runtime/lights', async (request, reply) => {
    const paging = paginationQuery.safeParse(request.query);
    if (!paging.success) return errorResponse(reply, 400, 'INVALID_QUERY', 'Invalid device-list pagination.');
    const requestWithAuth = request as RequestWithAuth;
    const tenant = await requireTenant(requestWithAuth, reply, integration);
    if (!tenant) return reply;
    const client = requestClient('devices', requestWithAuth, integration);
    if (!client) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');
    const { data, error, count } = await client.from('devices')
      .select('id,config,created_at', { count: 'planned' })
      .eq('isyen_id', tenant.isyenId)
      .eq('config->>hardware', 'esp32_s3_gpio_light')
      .order('created_at', { ascending: paging.data.order === 'asc' })
      .range(paging.data.offset, paging.data.offset + paging.data.limit - 1);
    if (error) return reportDatabaseError(request, reply, 'device_runtime_light_list', error);
    return reply.send({
      data: data ?? [],
      pagination: {
        limit: paging.data.limit,
        offset: paging.data.offset,
        total: count ?? data?.length ?? 0,
        total_is_estimate: true,
        has_more: (data?.length ?? 0) === paging.data.limit,
      },
    });
  });

  app.get('/api/v1/device-runtime/sensors', async (request, reply) => {
    const paging = sensorInventoryQuery.safeParse(request.query);
    if (!paging.success) return errorResponse(reply, 400, 'INVALID_QUERY', 'Invalid sensor-list pagination or home_id.');
    const requestWithAuth = request as RequestWithAuth;
    const tenant = await requireTenant(requestWithAuth, reply, integration);
    if (!tenant) return reply;
    const client = requestClient('devices', requestWithAuth, integration);
    if (!client) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');
    let query = client.from('devices')
      .select('id,home_id,room_id,name,config,status,last_seen_at,created_at', { count: 'planned' })
      .eq('isyen_id', tenant.isyenId)
      .eq('config->>hardware', 'esp32_s3_gpio_sensor');
    if (paging.data.home_id) query = query.eq('home_id', paging.data.home_id);
    const { data, error, count } = await query.order('created_at', { ascending: true })
      .range(paging.data.offset, paging.data.offset + paging.data.limit - 1);
    if (error) return reportDatabaseError(request, reply, 'device_runtime_sensor_list', error);
    return reply.send({
      data: data ?? [],
      pagination: {
        limit: paging.data.limit,
        offset: paging.data.offset,
        total: count ?? data?.length ?? 0,
        total_is_estimate: true,
        has_more: (data?.length ?? 0) === paging.data.limit,
      },
    });
  });

  app.get('/api/v1/device-runtime/sensor-readings/latest', async (request, reply) => {
    const query = z.object({ home_id: z.string().uuid() }).strict().safeParse(request.query);
    if (!query.success) return errorResponse(reply, 400, 'INVALID_HOME_ID', 'A valid home_id is required.');
    const requestWithAuth = request as RequestWithAuth;
    const tenant = await requireTenant(requestWithAuth, reply, integration);
    if (!tenant) return reply;
    const client = requestClient('sensor_data', requestWithAuth, integration);
    if (!client) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');
    const result = await client.rpc('latest_sensor_readings', { p_home_id: query.data.home_id, p_limit: 500 });
    if (result.error) return reportDatabaseError(request, reply, 'latest_sensor_readings', result.error);
    return reply.send({ data: result.data ?? [] });
  });

  app.post('/api/v1/device-runtime/:id/readings', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return errorResponse(reply, 400, 'INVALID_DEVICE_ID', 'A valid device ID is required.');
    const payload = sensorMeasurementBody.safeParse(request.body);
    if (!payload.success) return errorResponse(reply, 400, 'INVALID_SENSOR_READING', 'A finite numeric or boolean sensor value is required.');
    const requestWithAuth = request as RequestWithAuth;
    const tenant = await requireTenant(requestWithAuth, reply, integration);
    if (!tenant) return reply;
    const client = requestClient('devices', requestWithAuth, integration);
    if (!client) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');
    const device = await client.from('devices').select('id,config').eq('id', params.data.id).eq('isyen_id', tenant.isyenId).maybeSingle();
    if (device.error) return reportDatabaseError(request, reply, 'sensor_device_lookup', device.error);
    if (!device.data) return errorResponse(reply, 404, 'NOT_FOUND', 'Sensor device not found.');
    const config = device.data.config as Record<string, unknown> | null;
    if (!isValidEsp32S3SensorConfig(config) || config.enabled !== true) {
      return errorResponse(reply, 409, 'SENSOR_NOT_CONFIGURED', 'This device is not an enabled GPIO sensor.');
    }

    const input = payload.data.value;
    let numericValue: number;
    if (config.input_mode === 'analog') {
      if (typeof input !== 'number' || input < 0 || input > 4095) {
        return errorResponse(reply, 400, 'INVALID_SENSOR_READING', 'Analog sensor values must be between 0 and 4095.');
      }
      numericValue = input;
    } else if (typeof input === 'boolean') {
      numericValue = input ? 1 : 0;
    } else if (input === 0 || input === 1) {
      numericValue = input;
    } else {
      return errorResponse(reply, 400, 'INVALID_SENSOR_READING', 'Digital sensor values must be true, false, 0 or 1.');
    }

    const result = await client.rpc('record_sensor_reading', {
      p_device_id: params.data.id,
      p_value_numeric: numericValue,
      p_reported_at: payload.data.reported_at ? new Date(payload.data.reported_at).toISOString() : null,
    });
    if (result.error) return reportDatabaseError(request, reply, 'record_sensor_reading', result.error);
    const reading = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!reading) return errorResponse(reply, 503, 'SENSOR_WRITE_FAILED', 'The sensor reading could not be saved.');

    const heartbeat = await client.from('devices').update({ status: 'online', last_seen_at: new Date().toISOString() })
      .eq('id', params.data.id).eq('isyen_id', tenant.isyenId);
    if (heartbeat.error) request.log.warn({ databaseCode: heartbeat.error.code ?? 'unknown' }, 'Sensor heartbeat update failed');
    return reply.code(201).send({ data: reading });
  });

  app.post('/api/v1/device-runtime/:id/state', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return errorResponse(reply, 400, 'INVALID_DEVICE_ID', 'A valid device ID is required.');
    const payload = z.object({
      gpio: z.number().int(),
      relay_on: z.boolean(),
      rssi: z.number().int().min(-127).max(0).optional(),
    }).strict().safeParse(request.body);
    if (!payload.success || !isSafeEsp32S3OutputPin(payload.data.gpio)) {
      return errorResponse(reply, 400, 'INVALID_DEVICE_STATE', 'Reported state or GPIO pin is invalid.');
    }
    const requestWithAuth = request as RequestWithAuth;
    const tenant = await requireTenant(requestWithAuth, reply, integration);
    if (!tenant) return reply;
    const client = requestClient('devices', requestWithAuth, integration);
    if (!client) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');

    const deviceResult = await client.from('devices').select('id,config').eq('id', params.data.id).eq('isyen_id', tenant.isyenId).maybeSingle();
    if (deviceResult.error) return reportDatabaseError(request, reply, 'device_state_device_lookup', deviceResult.error);
    if (!deviceResult.data) return errorResponse(reply, 404, 'NOT_FOUND', 'Device row not found.');
    const config = deviceResult.data.config as Record<string, unknown> | null;
    if (!isValidEsp32S3LightConfig(config) || config.gpio !== payload.data.gpio) {
      return errorResponse(reply, 409, 'DEVICE_CONFIG_MISMATCH', 'Reported GPIO does not match the configured device.');
    }

    const now = new Date().toISOString();
    const deviceUpdate = await client.from('devices').update({ status: 'online', last_seen_at: now })
      .eq('id', params.data.id).eq('isyen_id', tenant.isyenId).select('id').maybeSingle();
    if (deviceUpdate.error) return reportDatabaseError(request, reply, 'device_heartbeat', deviceUpdate.error);
    const stateUpdate = await client.from('device_states').upsert({
      isyen_id: tenant.isyenId,
      device_id: params.data.id,
      state: { hardware: 'esp32_s3_gpio_light', gpio: payload.data.gpio, relay_on: payload.data.relay_on, rssi: payload.data.rssi ?? null },
      reported_at: now,
      received_at: now,
      source: 'esp32_s3',
    }, { onConflict: 'isyen_id,device_id' }).select('id,device_id,state,reported_at,received_at,source').single();
    if (stateUpdate.error) return reportDatabaseError(request, reply, 'device_state_upsert', stateUpdate.error);
    return reply.send({ data: stateUpdate.data });
  });
}
