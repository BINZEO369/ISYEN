import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { SupabaseIntegration } from '../integrations/supabase.js';
import { allowedOrderFields, isResourceName, protectedFields, resources } from './resources.js';

const idParams = z.object({ resource: z.string(), id: z.string().uuid() });
const resourceParams = z.object({ resource: z.string() });
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  order_by: z.string().default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  home_id: z.string().uuid().optional(),
  room_id: z.string().uuid().optional(),
  device_id: z.string().uuid().optional(),
  is_read: z.enum(['true', 'false']).optional(),
  status: z.string().max(40).optional(),
});
const jsonObject = z.record(z.unknown());

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

function sanitizeBody(input: unknown): Record<string, unknown> | null {
  const parsed = jsonObject.safeParse(input);
  if (!parsed.success) return null;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (!protectedFields.has(key)) output[key] = value;
  }
  return output;
}

async function requireTenant(request: RequestWithAuth, reply: FastifyReply, integration: SupabaseIntegration): Promise<Tenant | null> {
  const token = bearerToken(request);
  if (!token) {
    errorResponse(reply, 401, 'AUTH_REQUIRED', 'A valid Bearer access token is required.');
    return null;
  }
  if (!integration.configured || !integration.serviceClient) {
    errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase server integration is not configured.');
    return null;
  }
  const tenant = await integration.resolveTenant(token);
  if (!tenant) {
    errorResponse(reply, 401, 'TENANT_NOT_RESOLVED', 'Authenticated user has no active user profile.');
    return null;
  }
  request.accessToken = token;
  request.tenant = tenant;
  return tenant;
}

export function registerDatabaseRoutes(app: FastifyInstance, integration: SupabaseIntegration): void {
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/health') || request.url.startsWith('/ready')) return;
    const resource = (request.params as { resource?: string } | undefined)?.resource;
    if (!resource || !isResourceName(resource)) return;
    if (resources[resource].shared && request.method === 'GET') return;
    const tenant = await requireTenant(request as RequestWithAuth, reply, integration);
    if (!tenant) return reply;
  });

  app.get('/api/v1/:resource', async (request, reply) => {
    const parsedParams = resourceParams.safeParse(request.params);
    const parsedQuery = listQuery.safeParse(request.query);
    if (!parsedParams.success || !isResourceName(parsedParams.data.resource)) {
      return errorResponse(reply, 404, 'RESOURCE_NOT_FOUND', 'Unknown database resource.');
    }
    if (!parsedQuery.success) return errorResponse(reply, 400, 'INVALID_QUERY', parsedQuery.error.message);
    const resource = parsedParams.data.resource;
    if (!integration.configured || !integration.publicClient) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase server integration is not configured.');
    const requestWithAuth = request as RequestWithAuth;
    const client = resources[resource].shared
      ? integration.publicClient
      : integration.requestClient(requestWithAuth.accessToken ?? '');
    if (!client) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');
    const { limit, offset, order_by, order, home_id, room_id, device_id, is_read, status } = parsedQuery.data;
    if (!allowedOrderFields.has(order_by)) return errorResponse(reply, 400, 'INVALID_ORDER_BY', 'Unsupported order_by field.');
    let query = client.from(resource).select('*', { count: 'exact' }).range(offset, offset + limit - 1).order(order_by, { ascending: order === 'asc', nullsFirst: false });
    if (!resources[resource].shared) query = query.eq('isyen_id', requestWithAuth.tenant?.isyenId ?? '');
    if (home_id) query = query.eq('home_id', home_id);
    if (room_id) query = query.eq('room_id', room_id);
    if (device_id) query = query.eq('device_id', device_id);
    if (is_read) query = query.eq('is_read', is_read === 'true');
    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) return errorResponse(reply, 400, 'DATABASE_QUERY_FAILED', error.message);
    return reply.send({ data: data ?? [], pagination: { limit, offset, total: count ?? data?.length ?? 0 } });
  });

  app.get('/api/v1/:resource/:id', async (request, reply) => {
    const parsed = idParams.safeParse(request.params);
    if (!parsed.success || !isResourceName(parsed.data.resource)) return errorResponse(reply, 404, 'RESOURCE_NOT_FOUND', 'Unknown database resource or invalid id.');
    const resource = parsed.data.resource;
    if (!integration.configured || !integration.publicClient) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase server integration is not configured.');
    const requestWithAuth = request as RequestWithAuth;
    const client = resources[resource].shared ? integration.publicClient : integration.requestClient(requestWithAuth.accessToken ?? '');
    if (!client) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');
    let query = client.from(resource).select('*').eq('id', parsed.data.id);
    if (!resources[resource].shared) query = query.eq('isyen_id', requestWithAuth.tenant?.isyenId ?? '');
    const { data, error } = await query.maybeSingle();
    if (error) return errorResponse(reply, 400, 'DATABASE_QUERY_FAILED', error.message);
    if (!data) return errorResponse(reply, 404, 'NOT_FOUND', 'Resource row not found.');
    return reply.send({ data });
  });

  app.post('/api/v1/:resource', async (request, reply) => {
    const parsed = resourceParams.safeParse(request.params);
    if (!parsed.success || !isResourceName(parsed.data.resource)) return errorResponse(reply, 404, 'RESOURCE_NOT_FOUND', 'Unknown database resource.');
    const resource = parsed.data.resource;
    if (!resources[resource].write || resources[resource].serviceOnly) return errorResponse(reply, 403, 'WRITE_NOT_ALLOWED', 'This resource is read-only or service-managed.');
    const body = sanitizeBody(request.body);
    if (!body) return errorResponse(reply, 400, 'INVALID_BODY', 'Request body must be a JSON object.');
    const requestWithAuth = request as RequestWithAuth;
    const client = integration.requestClient(requestWithAuth.accessToken ?? '');
    if (!client) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');
    body.isyen_id = requestWithAuth.tenant?.isyenId;
    if (resource === 'user_profiles') body.auth_user_id = requestWithAuth.tenant?.authUserId;
    const { data, error } = await client.from(resource).insert(body).select('*').single();
    if (error) return errorResponse(reply, 400, 'DATABASE_INSERT_FAILED', error.message);
    return reply.code(201).send({ data });
  });

  app.patch('/api/v1/:resource/:id', async (request, reply) => {
    const parsed = idParams.safeParse(request.params);
    if (!parsed.success || !isResourceName(parsed.data.resource)) return errorResponse(reply, 404, 'RESOURCE_NOT_FOUND', 'Unknown database resource or invalid id.');
    const resource = parsed.data.resource;
    if (!resources[resource].write || resources[resource].serviceOnly) return errorResponse(reply, 403, 'WRITE_NOT_ALLOWED', 'This resource is read-only or service-managed.');
    const body = sanitizeBody(request.body);
    if (!body) return errorResponse(reply, 400, 'INVALID_BODY', 'Request body must be a JSON object.');
    const requestWithAuth = request as RequestWithAuth;
    const client = integration.requestClient(requestWithAuth.accessToken ?? '');
    if (!client) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');
    const { data, error } = await client.from(resource).update(body).eq('id', parsed.data.id).eq('isyen_id', requestWithAuth.tenant?.isyenId ?? '').select('*').single();
    if (error) return errorResponse(reply, 400, 'DATABASE_UPDATE_FAILED', error.message);
    return reply.send({ data });
  });

  app.delete('/api/v1/:resource/:id', async (request, reply) => {
    const parsed = idParams.safeParse(request.params);
    if (!parsed.success || !isResourceName(parsed.data.resource)) return errorResponse(reply, 404, 'RESOURCE_NOT_FOUND', 'Unknown database resource or invalid id.');
    const resource = parsed.data.resource;
    if (!resources[resource].write || resources[resource].serviceOnly) return errorResponse(reply, 403, 'DELETE_NOT_ALLOWED', 'This resource is read-only or service-managed.');
    const requestWithAuth = request as RequestWithAuth;
    const client = integration.requestClient(requestWithAuth.accessToken ?? '');
    if (!client) return errorResponse(reply, 503, 'SUPABASE_NOT_CONFIGURED', 'Supabase request client is unavailable.');
    const { error } = await client.from(resource).delete().eq('id', parsed.data.id).eq('isyen_id', requestWithAuth.tenant?.isyenId ?? '');
    if (error) return errorResponse(reply, 400, 'DATABASE_DELETE_FAILED', error.message);
    return reply.code(204).send();
  });
}
