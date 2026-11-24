# Secret Santa

A web app for organizing a Secret Santa among friends: create a group, share it by code, link or QR
code, let everyone pick their own name, and reveal your recipient once everyone has joined.

## Layout

| Path              | What                                                     |
| ----------------- | -------------------------------------------------------- |
| `apps/web`        | Vite + React + TypeScript web app                        |
| `packages/shared` | Pure TypeScript shared by the web app and Edge Functions |
| `supabase`        | Supabase config, migrations, Edge Functions, DB tests    |

## Development

Requires Node 22 and pnpm 10 (`corepack enable`).

```sh
pnpm install
pnpm dev           # start the web app
pnpm lint          # ESLint
pnpm typecheck     # tsc in every package
pnpm test          # Vitest unit tests
pnpm e2e           # Playwright end-to-end tests
pnpm format        # Prettier
```

The Supabase CLI is a dev dependency: `pnpm exec supabase start` runs the local stack (needs Docker).
