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
pnpm e2e           # Playwright end-to-end tests, API answered in the browser
pnpm format        # Prettier
```

## Web app

Hash routes (GitHub Pages has no deep-link fallback): `#/` home, `#/new` create a group,
`#/g/<id>` organizer dashboard, `#/join/<code>` pick your name, `#/g/<id>/me` your recipient,
`#/design` the design system. Strings are in `apps/web/src/i18n` (Italian and English); the
groups a device belongs to and their tokens live only in that device's localStorage.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (for example in `apps/web/.env.local`) to
point the app at a Supabase project; `pnpm stack:start` prints the local values. The dashboard
and the player page subscribe to the group's Realtime channel with that public key, so counts
and the reveal update without a refresh; without the key they still refresh on focus.

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
`supabase status`. With `SUPABASE_ANON_KEY` set too, they also listen on the Realtime channel
the web app uses, and check that it carries counts only.

`pnpm e2e:stack` is the launch test: three phones play a whole round against the local stack,
with real Postgres and Realtime. It needs `SUPABASE_ANON_KEY`, plus either `FUNCTIONS_URL` (the
served Edge Functions, as in CI) or `SUPABASE_SERVICE_ROLE_KEY` to answer them in process.

## Deploy

Every commit on `main` that passes CI is deployed by `.github/workflows/deploy.yml`, called from CI: database
migrations and Edge Functions to Supabase first, then the web app to GitHub Pages at
`https://<owner>.github.io/<repository>/`. It can also be started by hand from the Actions tab.

One-time setup:

1. Create a Supabase project (region close to your players, for example Frankfurt).
2. In the repository's **Settings → Secrets and variables → Actions**, add the secrets
   `SUPABASE_ACCESS_TOKEN` (a personal access token from the Supabase dashboard),
   `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_REF`, and the variables `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` (the project's public key; it is meant to ship in the web app).

Until all five are set, the deploy from CI skips itself and main stays green. 3. In **Settings → Pages**, set the source to **GitHub Actions**.

The service role key is never stored in the repository: the platform gives it to the Edge
Functions itself.
