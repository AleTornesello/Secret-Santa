export const GROUP_TTL_MS = 3_600_000;
export const defaultLimits = { maxGroups: 1000, maxSessions: 10000, maxSockets: 10000, maxSocketsPerSession: 5, maxMembershipsPerSession: 10, maxRateKeys: 20000, maxBodyBytes: 65536, maxSocketBytes: 4096 };
export type Limits = typeof defaultLimits;
export type AppConfig = { publicOrigin: string; production: boolean; host: string; port: number; trustedProxyHops: number; limits: Limits };
function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new Error('Invalid numeric configuration');
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) throw new Error('Numeric configuration out of range');
  return result;
}
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const production = env.NODE_ENV === 'production';
  if (production && !env.PUBLIC_ORIGIN) throw new Error('PUBLIC_ORIGIN is required in production');
  const port = integer(env.PORT, 3000, 0, 65535);
  const origin = new URL(env.PUBLIC_ORIGIN ?? 'http://127.0.0.1:' + port);
  if (!['http:', 'https:'].includes(origin.protocol) || (production && origin.protocol !== 'https:') || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid PUBLIC_ORIGIN');
  const limits = { ...defaultLimits };
  for (const key of Object.keys(limits) as (keyof Limits)[]) {
    const envKey = key.replace(/[A-Z]/g, c => '_' + c).toUpperCase();
    limits[key] = integer(env[envKey], limits[key], 1, key.endsWith('Bytes') ? 16_777_216 : 1_000_000);
  }
  return { publicOrigin: origin.origin, production, host: env.HOST ?? '127.0.0.1', port, trustedProxyHops: integer(env.TRUST_PROXY_HOPS, 0, 0, 3), limits };
}

