# Secret Santa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a single-server Secret Santa application that renders pages on the server, coordinates participants live, produces one private final draw, and deletes groups one hour after creation.

**Architecture:** One Node.js HTTP server hosts Express/EJS and Socket.IO. A synchronous group service owns all rules and in-memory state; both HTTP and socket handlers call it. Browser TypeScript updates server-rendered content and resynchronizes after interruptions.

**Tech Stack:** Node.js 24 LTS, TypeScript, Express, EJS, Socket.IO, cookie, Helmet, express-rate-limit; tsx and esbuild for development/build; Vitest, Supertest, socket.io-client, and Playwright for verification.

**Spec:** [Secret Santa requirements and design](../specs/2026-11-16-secret-santa-design.md). Read both documents before execution. The spec's proposed defaults remain proposals; this plan adopts them as its working baseline rather than marking them confirmed.

## Global Constraints

- The creator also participates and selects their name.
- Each participant receives exactly one recipient, each recipient is assigned exactly once, and nobody receives their own name.
- Each participant sees only their own recipient.
- The draw is final and cannot be repeated within the same group.
- The application is a web application with server-side rendering.
- The host server serves pages and manages real-time communication between devices.
- Group state is stored in memory only, without persistent storage.
- Each group expires one hour after creation. Activity and the draw do not reset this deadline.
- Between 2 and 50 participants, including the creator. With two participants, recipients are necessarily predictable.
- Fix the participant list at creation. To change it, create a new group.
- No accounts, emails, database, Redis, saved history, additional exclusion rules, or multiple application workers.
- Every listed identity must be claimed and connected, and the creator must own one connected identity, before drawing.
- Preserve identity and assignments through refreshes in the same browser. Losing the session prevents recovery after drawing.
- Never log names, invitation codes, session tokens, or recipient assignments. Never store group contents in browser storage.

## Review Focus

1. Unicode-equivalent, case-varied, whitespace-only, and HTML-looking names must be validated or displayed safely (Tasks 2 and 5).
2. Two devices claiming one name, a creator releasing their own name, and repeated draw submissions must preserve identity ownership and finality (Tasks 3 and 4).
3. A late private event, browser history restoration, or reconnect after expiry must never reveal a stale recipient (Tasks 6 and 7).
4. Closing one of several tabs must not mark the participant offline; releasing a name must revoke access in every old tab (Tasks 3, 6, and 7).
5. Cookie forgery, cross-origin connections, malformed socket messages, and repeated invalid invitations must fail safely without unbounded memory growth (Tasks 5 and 8).

---

## Starting point and implementation decisions

The repository contains the README and the specification, with no application code or dependencies. This is one connected product; a separate backend deployment or frontend application is unnecessary.

Working defaults from the spec include English text, a fixed roster, self-release and creator release before drawing, and no cross-device identity transfer. New implementation choices are listed here so they can be reviewed:

- Use npm and commit `package-lock.json`; select compatible supported package releases during Task 1 and lock them. Node.js 24 is currently an LTS line; see the [official release table](https://nodejs.org/en/about/previous-releases). Do not infer future package versions from this plan.
- Normalize names with `trim()` and Unicode NFC; count length in Unicode code points, maximum 80. Compare duplicate keys with `toLocaleLowerCase('en-US')` after normalization. Preserve normalized display spelling.
- Use 16 random bytes encoded as hexadecimal for invitation codes, 32 random bytes for opaque session tokens, and server-generated participant IDs. Generate randomness with `node:crypto`.
- Use a session cookie named `ss_session`, with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production. Its value is the opaque token, never JSON containing group data.
- Bind production security to an explicit `PUBLIC_ORIGIN`; never derive trusted origin from an arbitrary Host header. Allow plain HTTP only for local development and tests. Use `AppConfig.trustedProxyHops`, parsed from `TRUST_PROXY_HOPS` as an integer from 0 to 3, default 0.
- Put every state mutation in the synchronous service; no `await` between validating and committing a claim or draw. Notify subscribers after state is consistent, and isolate subscriber exceptions from committed mutations.
- Use full public snapshots with revisions plus session-specific snapshots/results. Disable Socket.IO connection-state recovery; reconnect by fetching authoritative state.
- Use server time to calculate remaining lifetime. Browser timers are advisory; server checks govern access.
- Apply the capacity defaults in Task 8. These are starting limits, not a promised production throughput.

## File map

| Files | Responsibility |
| --- | --- |
| `package.json`, `package-lock.json`, `.gitignore`, `.nvmrc` | Dependencies, commands, supported runtime, generated-file exclusions. |
| `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `scripts/build.mjs` | Type checking, server compilation, browser bundling, copying views/static files. |
| `src/config.ts`, `src/platform.ts`, `src/main.ts` | Typed configuration, testable application composition, production startup/shutdown. |
| `src/groups/types.ts`, `src/groups/errors.ts` | Domain DTOs, service contracts, safe error categories. |
| `src/groups/names.ts`, `src/groups/draw.ts`, `src/groups/service.ts` | Name validation, unbiased assignment algorithm, group state/lifetime/claims/presence. |
| `src/sessions/store.ts`, `src/http/session.ts`, `src/http/security.ts` | Bounded memory sessions, cookie handling, origin/CSRF checks and response headers. |
| `src/http/routes.ts`, `src/http/errors.ts` | Form routes, view models, safe error-to-HTTP translation. |
| `src/views/index.ejs`, `src/views/group.ejs`, `src/views/error.ejs`, `src/views/partials/*.ejs` | Server-rendered forms, roster, private result, and errors. |
| `src/realtime/contracts.ts`, `src/realtime/server.ts` | Typed socket protocol, subscriptions, presence, private delivery, teardown. |
| `src/browser/group.ts`, `src/browser/state.ts`, `src/public/styles.css` | Live DOM updates, expiry/reconnection, accessible responsive presentation. |
| `tests/helpers/platform.ts`, `tests/helpers/groups.ts` | Disposable servers, distinct cookie jars, fake clock, ready-group test setup. |
| `tests/unit/*.test.ts`, `tests/integration/*.test.ts` | Domain, HTTP, session, socket, privacy, lifetime, and capacity checks. |
| `tests/e2e/fixtures.ts`, `tests/e2e/exchange.spec.ts`, `tests/e2e/recovery.spec.ts`, `playwright.config.ts` | Real browser exchange and recovery scenarios. |
| `Dockerfile`, `.dockerignore`, `.env.example`, `docs/deployment.md`, `.github/workflows/ci.yml` | Reproducible hosting, operational guidance, and automated checks. |

## Shared contracts

Define these types in Task 2. Later tasks consume them without inventing parallel models. Internal records and assignment maps stay private to the group service.

```ts
type GroupCode = string;
type SessionId = string;
type ParticipantId = string;
type GroupStatus = 'WAITING' | 'DRAWN';
type Recipient = { id: ParticipantId; name: string };
type PublicParticipant = {
  id: ParticipantId; name: string; claimed: boolean; connected: boolean;
};
type PublicGroupState = {
  code: GroupCode; revision: number; status: GroupStatus;
  createdAt: number; expiresAt: number; serverNow: number;
  participants: PublicParticipant[]; ready: boolean;
};
type SessionGroupState = PublicGroupState & {
  selfId: ParticipantId | null; isCreator: boolean; recipient: Recipient | null;
};
type GroupChange = { code: GroupCode; revision: number; expired: boolean };
```

Use `GroupError` with a `code` union: `INVALID_NAMES`, `GROUP_UNAVAILABLE`, `NAME_TAKEN`, `ALREADY_CLAIMED`, `FORBIDDEN`, `NOT_READY`, `DRAW_FINAL`, `CAPACITY_REACHED`, `INVALID_REQUEST`. Error text never includes private records. `GROUP_UNAVAILABLE` covers missing and expired codes.

## Task 1: Establish a runnable server and test harness

**Files:** Create runtime/build/config files from the file map, `src/platform.ts`, `src/main.ts`, `src/config.ts`, and `tests/integration/platform.test.ts`.

**Interfaces:** `loadConfig(env: NodeJS.ProcessEnv): AppConfig`; `createPlatform(options: { config: AppConfig; now?: () => number }): Platform`. Initially `Platform` exposes `{ httpServer: Server; close(): Promise<void> }`; add `groups` in Task 2 and `sessions` in Task 5. Creation never listens automatically; tests listen on port 0. `main.ts` alone selects the configured port.

- [ ] Install runtime dependencies and dev dependencies listed above, including relevant `@types/*`. Add scripts: `dev` = `tsx watch src/main.ts`; `typecheck` = `tsc --noEmit`; `test` = `vitest run`; `build` = `node scripts/build.mjs`; `start` = `node dist/main.js`; `test:e2e` = `playwright test`. Configure ESM/NodeNext and explicit `.js` server import paths. Compile server TypeScript, bundle the browser separately, and copy views/styles to `dist` during build.
- [ ] Write `platform.test.ts` with `health_is_available_without_creating_a_session`: start an ephemeral server, `GET /healthz`, assert `200`, body `{ status: 'ok' }`, and no `Set-Cookie`; close it without leaked handles. Write `production_requires_an_https_public_origin`: invalid/missing origin throws during config loading.

  ```ts
  const response = await request(platform.httpServer).get('/healthz');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'ok' });
  expect(response.headers['set-cookie']).toBeUndefined();
  ```

- [ ] Run `npm test -- tests/integration/platform.test.ts`; expect behavior tests to fail because platform/config are not implemented, rather than because Vitest cannot start.
- [ ] Implement the factory, health route, strict config, and main entry. `AppConfig` includes `publicOrigin`, `production`, `host`, `port`, and `limits` from Task 8; test helpers supply explicit local values. Default local host is `127.0.0.1`, port `3000`; production container sets host `0.0.0.0`. Keep config parsing separate from domain logic.
- [ ] Run the targeted test, `npm run typecheck`, and `npm run build`; expect passing tests and compilable startup. There is no requirement for a browser bundle until Task 7 adds its entry file.
- [ ] Commit the runnable foundation: `chore: initialize TypeScript server and test tooling`.

## Task 2: Create, validate, and expire groups in memory

**Files:** Create `src/groups/types.ts`, `errors.ts`, `names.ts`, `service.ts`, `tests/unit/groups-lifetime.test.ts`, and `tests/helpers/groups.ts`; modify `src/platform.ts` to expose its `groups` service.

**Interfaces:** `validateNames(input: unknown): string[]`; `createGroupService(options: { now: () => number; maxGroups: number }): GroupService`. Initial methods: `create(names: unknown, creator: SessionId): SessionGroupState`, `get(code: GroupCode, session: SessionId): SessionGroupState`, `sweepExpired(): void`, `onChange(listener: (change: GroupChange) => void): () => void`, `close(): void`. Mutators return safe snapshots, never internal records.

- [ ] Write `validates_roster_boundaries_and_unicode`: 1/51 names, blank names, 81 code points, non-array/non-string inputs, case variants, and NFC-equivalent names fail with `INVALID_NAMES`; 2/50 valid names and an 80-code-point name succeed. Assert normalized names preserve display spelling.

  ```ts
  expect(validateNames([' Alice ', 'Bob'])).toEqual(['Alice', 'Bob']);
  expect(() => validateNames(['Alice', 'alice'])).toThrow(GroupError);
  expect(() => validateNames(['\u00e9', 'e\u0301'])).toThrow(GroupError);
  expect(() => validateNames(['A'.repeat(81), 'Bob'])).toThrow(GroupError);
  ```

- [ ] Write `expires_at_creation_plus_3600000`: with injected `now`, assert `expiresAt === createdAt + 3_600_000`; `get` succeeds at `+3_599_999` and throws `GROUP_UNAVAILABLE` at `+3_600_000`. Write `background_cleanup_removes_idle_groups`: fake timers reach the deadline without a request and an expired change is emitted exactly once.
- [ ] Run `npm test -- tests/unit/groups-lifetime.test.ts`; expect failures for missing validation/lifetime behavior.
- [ ] Implement the private map, random collision-checked codes, name validation, access guards, revisions, per-group cleanup timers, and sweep fallback. Use injected time for guards and fake timers for scheduled cleanup tests. `close()` clears timers and state. Copy snapshot arrays so consumers cannot mutate private records. Expiry notifications contain the code/revision only, no old assignment data.
- [ ] Run the targeted test and `npm run typecheck`; verify group-cap overflow rejects creation without leaving records or timers. Test IDs/codes for correct format and collisions with controlled randomness, not statistical entropy assertions.
- [ ] Commit: `feat: add expiring in-memory groups`.

## Task 3: Own participant claims and track live presence

**Files:** Modify `src/groups/service.ts` and `types.ts`; create `tests/unit/groups-membership.test.ts`.

**Interfaces:** Add `claim(code, session, participantId): SessionGroupState`, `release(code, actorSession, participantId): SessionGroupState`, `connect(code, session, connectionId: string): SessionGroupState`, and `disconnect(connectionId: string): void` to `GroupService`. Session/participant parameters use shared types; `disconnect` is idempotent. Connections belong to a session subscription even before it claims a name.

- [ ] Write `only_one_session_claims_a_name`, `one_claim_per_session_per_group`, and `creator_must_own_a_connected_identity_for_readiness`. Assert error codes and safe snapshot state. Claim/release actions are synchronous and cannot overwrite another owner.
- [ ] Write `multiple_tabs_count_as_one_participant`: connect two IDs for one session, disconnect one, and assert `connected === true`; disconnect the last and assert `false`. Write `release_revokes_all_old_tabs`: release an identity and assert the old session has `selfId === null`, while another session can claim it. The former session's still-open tabs must not make the new owner connected.

  ```ts
  const group = service.create(['Alice', 'Bob'], 'creator');
  const alice = group.participants[0].id;
  service.claim(group.code, 'creator', alice);
  service.connect(group.code, 'creator', 'tab-1');
  service.connect(group.code, 'creator', 'tab-2');
  service.disconnect('tab-1');
  expect(service.get(group.code, 'creator').participants[0].connected).toBe(true);
  service.disconnect('tab-2');
  expect(service.get(group.code, 'creator').participants[0].connected).toBe(false);
  ```

- [ ] Run `npm test -- tests/unit/groups-membership.test.ts`; expect failures for missing ownership/presence rules.
- [ ] Implement claims, creator authorization for releasing others, and readiness. Public changes increment revisions; a session can remain a public subscriber after releasing its name. Limit one subscribed group per socket connection; different tabs may subscribe to different groups. Clear connection indexes on disconnect, expiry, and shutdown.
- [ ] Run the targeted test and existing unit tests. Assert releasing one's own name does not remove creator permission, and a creator without a selected identity cannot become ready merely because other people claim all names.
- [ ] Commit: `feat: add identity claims and participant presence`.

## Task 4: Commit one valid private draw

**Files:** Create `src/groups/draw.ts`, `tests/unit/draw.test.ts`, and `tests/unit/groups-draw.test.ts`; modify `service.ts` and `types.ts`.

**Interfaces:** `assignRecipients(ids: readonly ParticipantId[], randomIndex?: (upperExclusive: number) => number): Map<ParticipantId, ParticipantId>`; `GroupService.draw(code: GroupCode, creator: SessionId): SessionGroupState`.

- [ ] Write `two_people_swap_recipients` and `permutation_has_unique_recipients_without_self_matches` for every supported size 2 through 50. Use controlled random sequences to prove that a permutation with a self-match is rejected and the next valid one is accepted; do not use flaky randomness-frequency thresholds.

  ```ts
  expect(assignRecipients(['alice', 'bob'])).toEqual(
    new Map([['alice', 'bob'], ['bob', 'alice']]),
  );
  ```

- [ ] Write `draw_requires_creator_and_all_connected_claims`, `creator_without_claim_cannot_draw`, `repeated_draw_returns_same_result`, `claims_and_releases_fail_after_draw`, and `deadline_rechecked_before_commit`. For the last case, advance the injected clock during assignment generation and assert no result commits after expiry.
- [ ] Run `npm test -- tests/unit/draw.test.ts tests/unit/groups-draw.test.ts`; expect failed assertions or missing implementation.
- [ ] Implement Fisher-Yates using `crypto.randomInt(upperExclusive)` and rejection of permutations with any fixed point. Generate/store the whole map and set `DRAWN` before notifying listeners. For test-controlled generation, allow `createGroupService` an optional `assign` dependency with the same `assignRecipients` signature; production always uses the cryptographic implementation.
- [ ] Implement finality: an authorized creator retry returns the existing session snapshot; a non-creator retry is still forbidden. Store no per-event private history. Verify `get` returns only the calling session's recipient and callers cannot modify stored assignments through returned objects.
- [ ] Run both targeted files, all unit tests, and `npm run typecheck`; expect no failed tests. Commit: `feat: add final private Secret Santa draw`.

## Task 5: Render the exchange through session-bound HTTP forms

**Files:** Create session/HTTP/view files from the file map, `tests/unit/sessions.test.ts`, `tests/integration/http.test.ts`, and `tests/helpers/platform.ts`; modify `src/platform.ts`.

**Interfaces:** `Session = { id: SessionId; csrfToken: string }`; `createSessionStore({ now, maxSessions, maxMembershipsPerSession }): SessionStore`, exposing `create(): Session`, `get(id: string): Session | undefined`, `canRetain(id: SessionId, code?: GroupCode): boolean`, `retain(id: SessionId, code: GroupCode, expiresAt: number): void`, `forgetGroup(code: GroupCode): void`, `sweepExpired(): void`, `close(): void`. `Platform.sessions` exposes this store. Routes only read `req.session` after middleware validates its cookie; augment Express request types locally.

- [ ] Write `session_cookie_is_opaque_and_secure_in_production`, `forged_cookie_never_grants_creator_access`, and `expired_group_drops_membership_and_unused_session`. Sessions without memberships live at most one hour from issue; when their last membership expires or is removed, delete them. Multiple active group memberships retain a shared session only until its last group deadline. Group retention never changes any group deadline.
- [ ] Write HTTP tests for all six spec routes using independent Supertest agents: create/redirect, select names, release a name, render waiting, draw after service-simulated connections, and render each person's private result. Assert unauthorized actions fail, duplicate claims return `409`, invalid input `400`, forbidden actions `403`, missing groups `404`, and capacity failures `429`.
- [ ] Submit simultaneous claim requests with `Promise.all` from two agents and assert exactly one `303` and one `409`. Submit simultaneous creator draw requests against a ready group and assert the final recipient for every session remains unchanged across responses and subsequent reads.
- [ ] Add `html_names_are_escaped_in_every_rendered_state`: names resembling HTML render as text, not executable markup. Add `private_pages_never_contain_another_givers_assignment`: inspect full HTML and bootstrap content, including creator responses. Verify initial HTML contains forms/roster or the caller's result without executing JavaScript.

  ```ts
  // `response` renders a roster containing the literal name <script>bad()</script>.
  expect(response.text).toContain('&lt;script&gt;bad()&lt;/script&gt;');
  expect(response.text).not.toContain('<script>bad()</script>');
  expect(response.headers['cache-control']).toBe('no-store');
  ```

- [ ] Run `npm test -- tests/unit/sessions.test.ts tests/integration/http.test.ts`; expect failures for missing routes/session behavior.
- [ ] Implement cookie parsing, session creation on creation/group pages, scoped membership retention, and EJS rendering with explicit safe view models. Prune expired session records before allocation/access and schedule cleanup for untouched records. Do not allocate sessions for unknown group codes, health requests, or static assets. Reconnects/requests for an unknown token receive no previous privileges. Keep session tokens out of page markup; render a separate CSRF token for forms/socket setup.
- [ ] Implement forms using the exact routes in spec section 11, `303` redirects after successful mutations, hidden CSRF fields, explicit claim/release IDs, and server-side authorization. Install same-origin and CSRF checks now rather than exposing unprotected mutations until Task 8. Render errors with a safe category and preserve only safe submitted values.
- [ ] Use one labelled `names` textarea for creation, one name per line. At the route boundary, require a string, trim the whole value, split on `\r?\n`, and pass the resulting array to `validateNames`; do not drop internal blank lines. Claim/release forms submit `participantId`, and all mutation forms submit `csrfToken`.
- [ ] Render only the caller's result in a visible result container; build bootstrap data from safe snapshots, escape `<` in serialized JSON, and parse it as inert data. Mark personal responses `Cache-Control: no-store`. Include a `<noscript>` explanation. On group expiry, call `sessions.forgetGroup` and remove unused records.
- [ ] Run both targeted test files and `npm run typecheck`; commit: `feat: add server-rendered exchange pages and sessions`.

## Task 6: Synchronize devices with authorized Socket.IO subscriptions

**Files:** Create realtime files and `tests/integration/realtime.test.ts`; modify `platform.ts` and test helpers.

**Interfaces:** `attachRealtime(httpServer: Server, groups: GroupService, sessions: SessionStore, config: AppConfig): { close(): Promise<void> }`. `group:subscribe` consumes `{ code: GroupCode, csrfToken: string }` and acknowledges `{ ok: true, snapshot: SessionGroupState } | { ok: false, error: string }`. `group:state` carries only `PublicGroupState`. `participant:result` carries `{ code, revision, recipient, expiresAt, serverNow }`; `participant:identity` carries `{ code, revision, selfId, isCreator }`; `participant:released` and `group:expired` carry `{ code, revision }`; `group:error` carries a safe category/message.

- [ ] Write integration tests with separate real socket clients and cookie jars: invalid session/origin/CSRF rejection; subscription returns a caller-only snapshot; claim/connect/disconnect updates observers; initial unclaimed subscription does not satisfy readiness; one socket cannot silently switch groups.
- [ ] Add `draw_delivers_only_own_result`, `reconnect_restores_existing_result`, `revoked_tabs_do_not_receive_new_owners_result`, and `expiry_removes_subscriptions_without_late_delivery`. Capture every event payload, not only rendered UI. Test WebSocket and polling transports. Use event acknowledgments/promises with deadlines, not arbitrary sleeps.

  ```ts
  // Capture `aliceEvents` from Alice's authenticated socket in the prepared draw.
  expect(aliceEvents.filter(e => e.name === 'participant:result')).toHaveLength(1);
  expect(aliceEvents.find(e => e.name === 'participant:result')?.payload.recipient)
    .toEqual(platform.groups.get(code, aliceSession.id).recipient);
  expect(aliceEvents.every(e => !('assignments' in e.payload))).toBe(true);
  ```

- [ ] Run `npm test -- tests/integration/realtime.test.ts`; expect failures for missing socket behavior.
- [ ] Implement handshake cookie checks and explicit same-origin validation for upgrades and polling. Authorize every subscription against current group/session state; transport middleware alone does not authorize subsequent messages. Keep recovery/history disabled. Set transport message limits from Task 8.
- [ ] Connect service presence after successful subscription. Listen to group changes: broadcast a fresh public snapshot, then compute private snapshots for current session owners and emit private results only to their authenticated sockets. Do not use public group rooms for private delivery. Recompute authorization at delivery time; do not reuse stale participant-to-room membership after release.
- [ ] Send expiry before leaving group rooms, remove socket/session/group indexes, and drop pending group-specific work. On disconnect call the idempotent service cleanup. `Platform.close()` removes service listeners and closes sockets, HTTP server, timers, and sessions without hanging tests.
- [ ] Run realtime and HTTP integration tests, then `npm run typecheck`; commit: `feat: synchronize group presence and private results`.

## Task 7: Complete the accessible browser flow and expiry behavior

**Files:** Create `src/browser/group.ts`, `src/browser/state.ts`, `src/public/styles.css`, and `tests/unit/browser-state.test.ts`; update views, build script, `playwright.config.ts`, and `tests/e2e/exchange.spec.ts`.

**Interfaces:** `ClientState = { snapshot: SessionGroupState; connected: boolean; expired: boolean; deadlineLocal: number }`; `applyPublicState(state, update: PublicGroupState, receivedAt: number): ClientState`; `applyPrivateResult(state, update: PrivateResult, receivedAt: number): ClientState`; `expireClient(state): ClientState`. Define/export `PrivateResult` in realtime contracts and share types through type-only browser imports.

- [ ] Write `ignores_older_revisions`, `ignores_results_after_terminal_expiry`, and `older_public_events_cannot_restore_cleared_result`. Calculate remaining lifetime from `expiresAt - serverNow` and receipt time so different browser clocks do not extend access. Any update at/past its deadline clears the private result.

  ```ts
  const expired = expireClient(stateWithRecipient);
  expect(expired.snapshot.recipient).toBeNull();
  expect(applyPrivateResult(expired, delayedResult, receivedAt).snapshot.recipient)
    .toBeNull();
  ```

- [ ] Configure Playwright for desktop Chromium, Firefox, WebKit, and mobile Chromium emulation. Until Task 9 introduces in-process fixtures, use `webServer` with `npm run dev` at `http://127.0.0.1:3000`. Write `three_independent_browsers_complete_one_exchange`: create three separate browser contexts, select identities, observe readiness without reloading, draw once, assert three unique non-self recipients, then reload and assert the same result. The creator's selected identity is mandatory.
- [ ] Run `npm test -- tests/unit/browser-state.test.ts` and `npm run test:e2e -- tests/e2e/exchange.spec.ts --project=chromium`; expect failures for missing live UI before implementing it. Install Playwright browsers as needed for execution, not while writing this plan.
- [ ] Implement the small browser controller using the bundled Socket.IO client. On connect subscribe and replace local state from the safe snapshot; while offline disable drawing and show reconnecting status. Public updates cannot replace private state belonging to a newer revision. While waiting, update available names, presence, readiness, and release controls without a reload; keep POST forms as authoritative mutations.
- [ ] Implement expiry on a timer, `visibilitychange`, and `pageshow` including history restoration: immediately hide/clear private content while validating current state, then resubscribe and show only an unexpired authoritative result. Treat expiry as terminal for that code. Same-browser tabs share a cookie but never write recipients to localStorage, sessionStorage, IndexedDB, service-worker caches, or URLs.
- [ ] Add labelled forms, keyboard-operable actions, visible focus, live status announcements, a copy-link action with selectable-link fallback, and a two-column-free mobile layout. Use text nodes when inserting names. Keep a visible explanation that the result must be remembered before the group expires.
- [ ] Run unit test, Chromium exchange test, `npm run typecheck`, and `npm run build`; manually inspect phone/desktop layouts. Commit: `feat: add live participant interface and private reveal`.

## Task 8: Bound resource usage and verify security failures

**Files:** Modify `config.ts`, session/HTTP/realtime modules; create `tests/integration/security.test.ts` and `tests/integration/capacity.test.ts`.

**Interfaces:** `AppConfig.limits = { maxGroups: 1000, maxSessions: 10000, maxSockets: 10000, maxSocketsPerSession: 5, maxMembershipsPerSession: 10, maxRateKeys: 20000, maxBodyBytes: 65536, maxSocketBytes: 4096 }` as defaults. Parse capacity overrides as integers from 1 to 1,000,000 and body/message limits from 1 to 16,777,216 bytes. Group lifetime remains the constant `3_600_000`, never an environment option. HTTP rate limits: 10 group creations/IP/10 minutes and 120 mutations/IP/minute. Socket subscription limit: 30 attempts/socket/minute.

- [ ] Write `rejects_forged_or_missing_csrf_and_cross_origin_mutations`, `rejects_cross_origin_websocket_and_polling`, `rejects_malformed_and_oversized_messages`, and `names_do_not_execute_scripts`. Assert safe error responses, no stack traces/secrets, no successful state mutations, and no additional sessions for unknown-code probes.
- [ ] Write `caps_groups_sessions_memberships_and_sockets_without_leaks` using deliberately tiny injected limits. Write `rate_limit_counters_expire`: after the window, old counters disappear and traffic resumes; distinct keys cannot exceed `maxRateKeys`. Verify disconnect and expiry release capacity. When a POST cannot retain session membership, it must not leave a newly created group or a claimed name behind. Add `maximum_valid_unicode_roster_fits_form_body`: 50 distinct 80-code-point names containing astral characters succeed through URL-encoded form submission within the 65,536-byte default.

  ```ts
  const names = Array.from({ length: 50 }, (_, i) =>
    String(i).padStart(2, '0') + '\u{1F381}'.repeat(78));
  expect(names.every(name => [...name].length === 80)).toBe(true);
  const body = new URLSearchParams({ names: names.join('\n'), csrfToken });
  expect(Buffer.byteLength(body.toString())).toBeLessThan(65_536);
  // Submit this form through the creator agent and assert a 303 redirect.
  ```

- [ ] Run `npm test -- tests/integration/security.test.ts tests/integration/capacity.test.ts`; expect failures for unimplemented limits/header behavior.
- [ ] Implement Helmet with a policy compatible with bundled local scripts/styles, forbid framing, avoid third-party resources, and set a restrictive referrer policy. Apply bounded body parsers, DTO validation, connection and active-group limits, and memory-only rate counters that prune expired entries and cap distinct keys. Use a capped in-memory store for express-rate-limit rather than an unlimited key map. Return `429` for capacity/rate rejection and `413` for oversized HTTP bodies. Do not disconnect an existing healthy session to admit an attacker.
- [ ] Call `sessions.canRetain` before mutating group state; keep capacity check, group mutation, and retention synchronous so capacity cannot change between them. Already retained groups consume no extra slot. Only trust configured proxy hops; document that the proxy must overwrite forwarded headers. Disable URL-bearing access logs; error logging uses sanitized categories and counts, including proxy examples. Do not persist production Socket.IO debugging output or private client traces.
- [ ] Run the targeted tests plus all HTTP/realtime integration tests; commit: `fix: enforce request security and bounded memory usage`.

## Task 9: Prove recovery, release, and expiry across real browsers

**Files:** Create `tests/e2e/fixtures.ts` and `tests/e2e/recovery.spec.ts`; extend test helpers and `exchange.spec.ts`.

**Interfaces:** Test fixture starts a disposable `createPlatform` instance on port 0 and exposes `{ baseURL, platform, advanceServerTime(ms): void }`. A mutable injected clock advances the service's `now`, then calls `groups.sweepExpired()`. No test HTTP endpoint or production TTL override is permitted. Install browser clocks in the test when deterministic deadline advancement is needed.

- [ ] Replace the Playwright `webServer` setting with the fixture-managed server for all browser tests, including Task 7's exchange scenario. Advance `sessions.sweepExpired()` with the group clock so idle sessions follow the same test timeline.

- [ ] Write `offline_then_reconnect_preserves_recipient`, `two_tabs_do_not_duplicate_identity_or_presence`, `creator_release_updates_all_old_tabs`, and `browser_history_cannot_restore_an_expired_recipient`. Assert both displayed behavior and server snapshot state; use fresh contexts to simulate unrelated devices.
- [ ] Write `expiry_before_draw_blocks_every_action` and `expiry_after_draw_clears_all_results`: advance to exactly `createdAt + 3_600_000`, test connected and offline tabs, then restore visibility/network and ensure no stale result reappears. Assert codes become unavailable and a lost cookie cannot reclaim a drawn identity.

  ```ts
  advanceServerTime(3_600_000); // Fixture begins at this group's creation time.
  await expect(alicePage.getByTestId('recipient')).toBeHidden();
  expect(() => platform.groups.get(code, aliceSessionId))
    .toThrow(expect.objectContaining({ code: 'GROUP_UNAVAILABLE' }));
  ```

- [ ] Run `npm run test:e2e -- tests/e2e/recovery.spec.ts --project=chromium`; investigate failures against the existing design. Fix only behavior exposed by these integration scenarios; avoid introducing test-only production features.
- [ ] Run the complete Playwright matrix and `npm test`; expect all scenarios to pass without real one-hour waits. Disable trace/video capture by default because these artifacts can contain test recipients; use synthetic names if debugging requires local capture.
- [ ] Commit: `test: verify multi-device recovery and group expiry`.

## Task 10: Package one server and document operation

**Files:** Create hosting/CI files from the map; update README with setup, scripts, limits, and links to the spec, plan, and deployment guide.

**Interfaces:** Production image starts `node dist/main.js`, serves `/healthz`, listens on configured `HOST`/`PORT`, runs as a non-root user, and handles SIGINT/SIGTERM through `Platform.close()`. Environment: `NODE_ENV`, `HOST`, `PORT`, `PUBLIC_ORIGIN`, explicit proxy trust, and positive capacity overrides. No database/secrets service or persistent volume is required.

- [ ] Add a production startup smoke check to `tests/integration/platform.test.ts`: execute the built entry on a free port, assert health and SSR/static asset delivery, shut down, and assert exit without leaked handles. Add `restart_loses_existing_group`: create a group in one platform, close it, create another, and assert the old code is unavailable. Tests use no persistent store.

  ```ts
  const group = first.groups.create(['Alice', 'Bob'], 'creator');
  await first.close();
  expect(() => second.groups.get(group.code, 'creator'))
    .toThrow(expect.objectContaining({ code: 'GROUP_UNAVAILABLE' }));
  ```

- [ ] Run the smoke check after `npm run build`; expect initial failure for missing packaging/startup behavior if applicable.
- [ ] Add a multi-stage Node.js 24 image that builds once, ships runtime dependencies and `dist`, starts one process, and includes no test reports or source secrets. Add `.env.example` with safe local values. Document HTTPS, same-origin socket forwarding, proxy idle timeouts, no autoscaling/cluster workers, restart data loss, and memory/capacity monitoring.
- [ ] Add CI steps in this order: `npm ci`, `npm run typecheck`, `npm run build`, `npm test`, Playwright browser installation, and `npm run test:e2e`. Build before the test suite because the production startup smoke test consumes `dist`. Use local locked dependencies. Do not deploy or publish automatically as part of this plan.
- [ ] Run all documented local commands on a clean dependency install. If Docker is available, run `docker build -t secret-santa:local .` and smoke-test a disposable container; otherwise report container verification as pending rather than claiming it passed. Use sanitized health/error logs only.
- [ ] Commit: `chore: package single-server deployment and CI`.

## Requirement coverage and completion evidence

| Specification requirement | Owning tasks | Evidence |
| --- | --- | --- |
| R1-R2: creation and link | 2, 5, 7 | Validation/HTTP tests and a shared invitation opened in independent browsers. |
| R3-R4: identity and creator participation | 3, 5, 6, 9 | Claim race, creator-without-claim rejection, release and multiple-tab tests. |
| R5: readiness | 3, 4, 6, 7 | Server rejects incomplete/offline groups; browser reflects authoritative readiness. |
| R6: valid assignments | 4 | Permutation invariants across all group sizes and controlled rejection-path test. |
| R7: private results | 4, 5, 6, 8 | Full HTML, bootstrap, and captured event payloads inspected for other assignments. |
| R8: finality | 4, 9 | Repeated draw, reload, and reconnect preserve the committed map. |
| R9: server rendering | 5, 7, 10 | Content present without JavaScript; build/start smoke check. |
| R10: real-time communication | 6, 7, 9 | Independent browser contexts receive presence and results without manual refresh. |
| R11: memory-only state | 2, 5, 8, 10 | Cleanup/capacity tests, no content persistence, and restart-loss test. |
| R12: fixed one-hour expiry | 2, 4, 6, 7, 9 | Exact boundary, idle cleanup, draw/expiry conflict, and stale-page tests. |

Completion means all owning tasks have their checks recorded, documented commands work, and limitations are accurately stated. Do not call the platform implemented while browser, expiry, privacy, or startup checks remain unverified.

## Execution order and handoff

Execute Tasks 1 through 10 in order. They share service contracts and are not independent frontend/backend assignments. Prefer native execution in one session, with a final independent review, because the small application has tightly connected interfaces. Use a task-by-task subagent workflow only if the user chooses it.

Before implementation, review the adopted defaults and confirm the plan captures the desired platform. This request produces a plan only; it does not install packages, write application code, or start deployment.

Useful primary references for execution: [Vitest setup](https://vitest.dev/guide/), [Playwright configuration](https://playwright.dev/docs/test-configuration), and [Socket.IO middleware](https://socket.io/docs/v4/middlewares/). Socket middleware executes per connection; handlers still need operation-level authorization.
