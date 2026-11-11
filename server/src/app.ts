import { createHash } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig, type AppConfig } from './config.js';
import { createSupabaseIntegration, type SupabaseIntegration } from './integrations/supabase.js';
import { registerDatabaseRoutes } from './routes/database.js';

export function buildApp(config: AppConfig, integration: SupabaseIntegration = createSupabaseIntegration(config)) {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ['req.headers.authorization', 'headers.authorization'],
    },
    bodyLimit: 1_048_576,
  });
  const origins = config.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

  void app.register(helmet);
  void app.register(cors, {
    origin: origins.includes('*') ? true : origins,
    // The API uses Bearer tokens, not cross-site cookies.
    credentials: false,
  });
  void app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow,
    keyGenerator: (request) => {
      const authorization = request.headers.authorization;
      if (authorization?.startsWith('Bearer ')) {
        const digest = createHash('sha256').update(authorization.slice('Bearer '.length)).digest('hex');
        return `bearer:${digest}`;
      }
      return `ip:${request.ip}`;
    },
  });

  const healthResponse = () => ({
    status: 'ok',
    service: '@isyen/server',
    timestamp: new Date().toISOString(),
    endpoints: { health: '/health', readiness: '/ready', api: '/api/v1' },
  });
  // Root and the common health probe aliases all return an unauthenticated HTTP 200.
  app.get('/', async () => healthResponse());
  app.get('/health', async () => healthResponse());
  app.get('/healthz', async () => healthResponse());

  app.get('/ready', async (_request, reply) => {
    if (!integration.configured || !integration.publicClient) {
      return reply.code(503).send({ status: 'not_ready', service: '@isyen/server', reason: 'supabase_not_configured' });
    }
    try {
      // Probe Auth without needing a database table grant or bypassing table RLS.
      const reachable = await integration.checkReadiness();
      if (!reachable) return reply.code(503).send({ status: 'not_ready', service: '@isyen/server', reason: 'supabase_unreachable' });
      return reply.send({ status: 'ready', service: '@isyen/server', timestamp: new Date().toISOString() });
    } catch {
      return reply.code(503).send({ status: 'not_ready', service: '@isyen/server', reason: 'supabase_unreachable' });
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorCode = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : undefined;
    request.log.error({ errorName, errorCode }, 'Unhandled request error');
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } });
  });

  registerDatabaseRoutes(app, integration);
  return app;
}

// The local entrypoint owns listen(); serverless adapters can use this handler.
const vercelApp = buildApp(loadConfig());

export default async function vercelHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  await vercelApp.ready();
  vercelApp.server.emit('request', request, response);
}
