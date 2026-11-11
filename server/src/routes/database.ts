import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { SupabaseIntegration } from '../integrations/supabase.js';
import { isResourceName, resourceNames, resources, type FieldRule, type ResourceName } from './resources.js';

const idParams = z.object({ resource: z.string(), id: z.string().uuid() });
const resourceParams = z.object({ resource: z.string() });
const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  order_by: z.string().min(1).max(64).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
}).passthrough();

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

    const { data, error } = await client.from(resource)
      .insert({ ...body.value, isyen_id: tenant.isyenId })
      .select(definition.select)
      .single();
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

    let query = client.from(resource).update(body.value).eq('id', parsed.data.id);
    query = scopedQuery(query, resource, tenant);
    const { data, error } = await query.select(definition.select).maybeSingle();
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
}
