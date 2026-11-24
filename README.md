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

## Database

The Supabase CLI is a dev dependency and needs Docker.

```sh
pnpm db:start      # start a local Postgres with the migrations applied
pnpm db:reset      # re-apply every migration from scratch
pnpm test:db       # pgTAP tests in supabase/tests/database
```

Every table has RLS on with no policies, and the public API roles have no privileges: clients
cannot read or write anything directly. Edge Functions use the service role and check the
caller's secret token.

## API

Six Edge Functions in `supabase/functions`, all `POST` with a JSON body. Tokens go in
`Authorization: Bearer <token>`. Errors come back as `{ "error": "<code>" }`.

| Function            | Token  | Does                                                         |
| ------------------- | ------ | ------------------------------------------------------------ |
| `create-group`      | none   | Creates the group and its names; returns the code and tokens |
| `preview-group`     | none   | Group name, budget, names and who has joined, by join code   |
| `join-group`        | none   | Claims a name; the last claim draws everyone automatically   |
| `get-group`         | admin  | The organizer's view, with the join code                     |
| `release-claim`     | admin  | Frees a name claimed by mistake, before the draw             |
| `get-my-assignment` | player | Your own name and, once drawn, your recipient                |

Every claim and the draw broadcast `{ joined, total, takenIds, status }` on the Realtime channel
`group:<id>`, event `progress`. Assignments never leave the database except through
`get-my-assignment`, to their own giver.

```sh
pnpm stack:start        # Postgres, REST, Realtime and the Edge Functions
pnpm test:integration   # API tests: against FUNCTIONS_URL if set, else the handlers in process
```

Without `FUNCTIONS_URL`, the integration tests need `SUPABASE_SERVICE_ROLE_KEY` from
`supabase status`.
