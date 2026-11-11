import Fastify from 'fastify';
import type { AppConfig } from './config.js';

export function buildApp(config: AppConfig) {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ['req.headers.authorization', 'headers.authorization'],
    },
  });

  // Bootstrap-only liveness endpoint. Add product routes after requirements and
  // data contracts have been established; no business APIs are implemented yet.
  app.get('/health', async () => ({
    status: 'ok',
    service: '@isyen/server',
    timestamp: new Date().toISOString(),
  }));
  return app;
}
