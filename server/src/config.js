const bool = (v, d) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

export function loadConfig(env = process.env) {
  const store = (env.STORE || 'postgres').toLowerCase();
  const cfg = {
    port: Number(env.PORT) || 8787,
    store,
    databaseUrl: env.DATABASE_URL || '',
    jwtSecret: env.JWT_SECRET || '',
    allowRegistration: bool(env.ALLOW_REGISTRATION, true),
    trustProxy: bool(env.TRUST_PROXY, false),
    allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    accessTtlSec: 15 * 60,
    refreshTtlSec: 60 * 24 * 3600,
    maxBodyBytes: 2 * 1024 * 1024,
    maxPayloadChars: 256 * 1024,
    maxPushRecords: 200,
    maxRecordsPerUser: 50_000,
    pullPageSize: 300,
  };
  if (cfg.jwtSecret.length < 32) throw new Error('JWT_SECRET must be set and at least 32 characters long.');
  if (store === 'postgres' && !cfg.databaseUrl) throw new Error('DATABASE_URL is required (copy the pooled connection string from the Neon dashboard).');
  if (store !== 'postgres' && store !== 'memory') throw new Error('STORE must be "postgres" or "memory".');
  return cfg;
}
