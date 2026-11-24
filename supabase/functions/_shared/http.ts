import type { ApiErrorCode } from '../../../packages/shared/src/index.ts';
import type { z } from 'zod';

export class ApiFailure extends Error {
  constructor(readonly code: ApiErrorCode) {
    super(code);
  }
}

const STATUS: Record<ApiErrorCode, number> = {
  invalid_input: 400,
  unauthorized: 401,
  not_found: 404,
  already_taken: 409,
  group_drawn: 409,
  joining_closed: 409,
  rate_limited: 429,
  internal: 500,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Max-Age': '86400',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export interface RequestContext {
  /** The token from `Authorization: Bearer <token>`, if any. */
  bearer: string | null;
  /** The caller's IP address as the platform reports it. */
  ip: string;
}

export interface Endpoint<Schema extends z.ZodType, Result = unknown> {
  input: Schema;
  run(input: z.output<Schema>, context: RequestContext): Promise<Result>;
}

/**
 * The hosted platform sits behind Cloudflare, which sets CF-Connecting-IP itself. Without it,
 * the last X-Forwarded-For entry is the one our own gateway added; earlier entries are whatever
 * the client sent. Rate limits are abuse protection only: the tokens are the security boundary.
 */
function clientIp(request: Request): string {
  const cloudflare = request.headers.get('cf-connecting-ip')?.trim();
  if (cloudflare) return cloudflare;
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  return forwarded || 'unknown';
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '');
  return match?.[1] ?? null;
}

/** Turns an endpoint into a request handler: CORS, POST + JSON only, validation, error codes. */
export function handler<Schema extends z.ZodType, Result>(endpoint: Endpoint<Schema, Result>) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== 'POST') return json({ error: 'invalid_input' }, 405);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_input' }, 400);
    }
    const parsed = endpoint.input.safeParse(body);
    if (!parsed.success) return json({ error: 'invalid_input' }, 400);

    try {
      const result = await endpoint.run(parsed.data, {
        bearer: bearerToken(request),
        ip: clientIp(request),
      });
      return json(result);
    } catch (error) {
      if (error instanceof ApiFailure) return json({ error: error.code }, STATUS[error.code]);
      console.error(error);
      return json({ error: 'internal' }, 500);
    }
  };
}
