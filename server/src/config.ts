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
  const nodeEnv = env.NODE_ENV ?? 'development';
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
  const corsOrigin = env.CORS_ORIGIN ?? 'http://localhost:3000';
  if (nodeEnv === 'production' && (!optionalEnv(env, 'CORS_ORIGIN') || corsOrigin.split(',').some((origin) => origin.trim() === '*'))) {
    throw new Error('CORS_ORIGIN must contain explicit frontend origins in production; wildcard is not allowed');
  }
  const supabaseUrl = optionalEnv(env, 'SUPABASE_URL');
  if (supabaseUrl) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(supabaseUrl);
    } catch {
      throw new Error('SUPABASE_URL must be a valid HTTPS URL');
    }
    if (parsedUrl.protocol !== 'https:' && nodeEnv === 'production') {
      throw new Error('SUPABASE_URL must use HTTPS in production');
    }
  }
  return {
    nodeEnv,
    host: env.HOST ?? '0.0.0.0',
    port,
    logLevel,
    corsOrigin,
    supabaseUrl,
    supabaseAnonKey: optionalEnv(env, 'SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: optionalEnv(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    rateLimitMax,
    rateLimitWindow: env.RATE_LIMIT_WINDOW ?? '1 minute',
  };
}
