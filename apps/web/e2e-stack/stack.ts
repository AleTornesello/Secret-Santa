import type { BrowserContext } from '@playwright/test';

type FetchFunction = (name: string, init: RequestInit) => Promise<Response>;

// Loaded only when needed, and kept out of the web app's type check, which has no Deno types.
const FUNCTIONS_CLIENT = '../../../supabase/functions/integration/client.ts';

export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';

/**
 * With FUNCTIONS_URL set (CI), the browser calls the real Edge Functions. Without it (a
 * machine whose edge runtime cannot fetch npm packages), the same handlers answer from this
 * process against the same database, so Realtime and Postgres stay real either way.
 */
export async function routeToStackFunctions(context: BrowserContext) {
  if (process.env.FUNCTIONS_URL) return;
  const { fetchFunction } = (await import(FUNCTIONS_CLIENT)) as { fetchFunction: FetchFunction };
  await context.route(`${SUPABASE_URL}/functions/v1/*`, async (route) => {
    const request = route.request();
    const name = new URL(request.url()).pathname.split('/').at(-1) ?? '';
    const response = await fetchFunction(name, {
      method: request.method(),
      headers: request.headers(),
      body: request.method() === 'POST' ? request.postData() : undefined,
    });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}
