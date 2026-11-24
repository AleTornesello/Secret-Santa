import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiFailure, handler, type RequestContext } from './http.ts';

function post(body: string, headers: Record<string, string> = {}) {
  return new Request('http://local/fn', { method: 'POST', body, headers });
}

describe('handler', () => {
  const seen: RequestContext[] = [];
  const echo = handler({
    input: z.object({ value: z.number() }),
    run: async (input, context) => {
      seen.push(context);
      if (input.value === 1) throw new ApiFailure('already_taken');
      if (input.value === 2) throw new Error('boom');
      return { doubled: input.value * 2 };
    },
  });

  it('answers CORS preflight and refuses other methods', async () => {
    const preflight = await echo(new Request('http://local/fn', { method: 'OPTIONS' }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
    expect((await echo(new Request('http://local/fn'))).status).toBe(405);
  });

  it('validates the body', async () => {
    expect((await echo(post('not json'))).status).toBe(400);
    const wrong = await echo(post('{"value":"x"}'));
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toEqual({ error: 'invalid_input' });
  });

  it('returns results and maps failures to status codes', async () => {
    expect(await (await echo(post('{"value":4}'))).json()).toEqual({ doubled: 8 });
    const taken = await echo(post('{"value":1}'));
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: 'already_taken' });
  });

  it('hides unexpected errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failed = await echo(post('{"value":2}'));
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: 'internal' });
    log.mockRestore();
  });

  it('reads the bearer token and a trustworthy client address', async () => {
    seen.length = 0;
    await echo(
      post('{"value":3}', { authorization: 'Bearer abc', 'cf-connecting-ip': '198.51.100.7' }),
    );
    await echo(post('{"value":3}', { 'x-forwarded-for': '1.1.1.1, 10.0.0.2' }));
    await echo(post('{"value":3}'));
    expect(seen).toEqual([
      { bearer: 'abc', ip: '198.51.100.7' },
      { bearer: null, ip: '10.0.0.2' },
      { bearer: null, ip: 'unknown' },
    ]);
  });
});
