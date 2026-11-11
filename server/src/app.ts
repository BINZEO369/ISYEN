import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import type { AppConfig } from './config.js';
import { createSupabaseIntegration } from './integrations/supabase.js';
import { registerDatabaseRoutes } from './routes/database.js';

export function buildApp(config: AppConfig) {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ['req.headers.authorization', 'headers.authorization'],
    },
    bodyLimit: 1_048_576,
  });
  const integration = createSupabaseIntegration(config);

  void app.register(helmet);
  void app.register(cors, { origin: config.corsOrigin === '*' ? true : config.corsOrigin, credentials: true });
  void app.register(rateLimit, { max: config.rateLimitMax, timeWindow: config.rateLimitWindow });

  app.get('/health', async () => ({
    status: 'ok',
    service: '@isyen/server',
    timestamp: new Date().toISOString(),
  }));

  app.get('/ready', async (_request, reply) => {
    if (!integration.configured || !integration.serviceClient) {
      return reply.code(503).send({ status: 'not_ready', service: '@isyen/server', reason: 'supabase_not_configured' });
    }
    const { error } = await integration.serviceClient.from('user_profiles').select('id').limit(1);
    if (error) return reply.code(503).send({ status: 'not_ready', service: '@isyen/server', reason: 'supabase_unreachable' });
    return reply.send({ status: 'ready', service: '@isyen/server', timestamp: new Date().toISOString() });
  });

  registerDatabaseRoutes(app, integration);
  return app;
}
