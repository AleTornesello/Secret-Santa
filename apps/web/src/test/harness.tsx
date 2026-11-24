import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { App } from '../App';

/** A handler's answer when the API should fail, for example `fail(409, 'already_taken')`. */
export class Failure {
  constructor(
    readonly status: number,
    readonly error: string,
  ) {}
}

export const fail = (status: number, error: string) => new Failure(status, error);

export type Handler = (body: Record<string, unknown>, init: RequestInit) => unknown;

export interface ApiCall {
  name: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}

/** Answers the Edge Function calls in place of the network; unknown functions are 404s. */
export function mockApi(handlers: Record<string, Handler>): ApiCall[] {
  const calls: ApiCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const name = url.split('/').at(-1) ?? '';
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      calls.push({ name, body, headers: init.headers as Record<string, string> });
      const handler = handlers[name];
      const result = handler ? handler(body, init) : fail(404, 'not_found');
      return result instanceof Failure
        ? new Response(JSON.stringify({ error: result.error }), { status: result.status })
        : new Response(JSON.stringify(result), { status: 200 });
    }),
  );
  return calls;
}

/** Renders the app at a hash route, in English. */
export function go(path: string) {
  window.location.hash = `#${path}`;
  render(<App locale="en" />);
}

/** Fresh storage and network for every test in the calling file. */
export function resetAppBetweenTests() {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.location.hash = '';
  });
}
