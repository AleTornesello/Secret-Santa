import type { ApiErrorCode } from '../../../packages/shared/src/index.ts';

// Vitest runs these tests in Node.
declare const process: { env: Record<string, string | undefined> };

export interface CallResult<T> {
  status: number;
  body: T & { error?: ApiErrorCode };
}

type Fetcher = (name: string, init: RequestInit) => Promise<Response>;

/**
 * With FUNCTIONS_URL set (CI runs `supabase functions serve`), requests go to the real Edge
 * Functions. Without it, the same handlers run in this process against the local stack.
 */
async function makeFetcher(): Promise<Fetcher> {
  const base = process.env.FUNCTIONS_URL;
  if (base) return (name, init) => fetch(`${base}/${name}`, init);

  const env: Record<string, string | undefined> = {
    SUPABASE_URL: process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  (globalThis as { Deno?: unknown }).Deno = {
    env: { get: (key: string) => env[key] },
    serve: () => undefined,
  };
  const { serviceRpc } = await import('../_shared/db.ts');
  const endpoints = await import('../_shared/endpoints.ts');
  const { handler } = await import('../_shared/http.ts');
  const rpc = serviceRpc();
  const handlers: Record<string, (request: Request) => Promise<Response>> = {
    'create-group': handler(endpoints.createGroup(rpc)),
    'preview-group': handler(endpoints.previewGroup(rpc)),
    'join-group': handler(endpoints.joinGroup(rpc)),
    'get-group': handler(endpoints.getGroup(rpc)),
    'release-claim': handler(endpoints.releaseClaim(rpc)),
    'get-my-assignment': handler(endpoints.getMyAssignment(rpc)),
  };
  return (name, init) => {
    const run = handlers[name];
    if (!run) throw new Error(`Unknown function ${name}`);
    return run(new Request(`http://local/${name}`, init));
  };
}

const fetcherPromise = makeFetcher();
let ipCounter = 0;

/** Each test client gets its own address, so rate limits do not leak between tests. */
export function newClientIp(): string {
  ipCounter++;
  return `203.0.113.${ipCounter % 250}-${Date.now()}-${Math.random()}`;
}

export async function call<T = Record<string, unknown>>(
  name: string,
  body: unknown,
  options: { token?: string; ip?: string } = {},
): Promise<CallResult<T>> {
  const fetcher = await fetcherPromise;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.ip) headers['CF-Connecting-IP'] = options.ip;
  const response = await fetcher(name, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as CallResult<T>['body'] };
}
