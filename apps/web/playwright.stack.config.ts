import { defineConfig, devices } from '@playwright/test';

/**
 * The launch test: the built app against a real local Supabase (`pnpm stack:start`), with
 * real Realtime. Needs SUPABASE_ANON_KEY; see e2e-stack/stack.ts for how functions are reached.
 */
const port = 4174;
const supabaseUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';

export default defineConfig({
  testDir: './e2e-stack',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'off',
  },
  // Each test opens one phone-sized browser context per player.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${port} --strictPort`,
    port,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '',
    },
  },
});
