export interface AppConfig {
  nodeEnv: string;
  host: string;
  port: number;
  logLevel: string;
  corsOrigin: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  rateLimitMax: number;
  rateLimitWindow: string;
}

function optionalEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const logLevel = env.LOG_LEVEL ?? 'info';
  if (!['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'].includes(logLevel)) {
    throw new Error('LOG_LEVEL is invalid');
  }
  const rateLimitMax = Number(env.RATE_LIMIT_MAX ?? 120);
  if (!Number.isInteger(rateLimitMax) || rateLimitMax < 1) {
    throw new Error('RATE_LIMIT_MAX must be a positive integer');
  }
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    host: env.HOST ?? '0.0.0.0',
    port,
    logLevel,
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:3000',
    supabaseUrl: optionalEnv(env, 'SUPABASE_URL'),
    supabaseAnonKey: optionalEnv(env, 'SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: optionalEnv(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    rateLimitMax,
    rateLimitWindow: env.RATE_LIMIT_WINDOW ?? '1 minute',
  };
}
