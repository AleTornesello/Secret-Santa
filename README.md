# Secret Santa

Secret Santa is a web application for organizing a live gift exchange. A creator enters the participant names and shares an invitation link. Each person opens the link and selects their name. When everyone is connected, the creator starts a final draw and each participant privately receives the name of their gift recipient.

## Requirements

- The creator also participates in the exchange.
- Each participant gives to exactly one other participant and receives from exactly one participant.
- Nobody can draw their own name.
- The draw is final: reconnecting or refreshing must never generate a new assignment.
- Pages are rendered on the server, with real-time updates between devices.
- One application server serves pages, manages connections, and owns group state.
- Groups are stored only in memory and expire one hour after creation.
- Joining, drawing, and reconnecting never extend a group's lifetime.

## Run locally

Use Node.js 24 and npm:

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:3000. If the port is busy, change both `PORT` and `PUBLIC_ORIGIN`. See [.env.example](.env.example) and the [deployment guide](docs/deployment.md) for environment-file usage, HTTPS, Docker, and resource limits.

`npm run dev` watches server TypeScript. Run `npm run build` again after changing browser TypeScript; views and styles are read directly from source in development. Production serves compiled files from `dist`.

## Verify

```sh
npm run typecheck
npm run build
npm test
npx playwright install chromium firefox webkit
npm run test:e2e
```

Build before the test suite because the production startup smoke test runs the compiled entry point. Browser tests create disposable servers on free ports and use synthetic names. They cover desktop Chromium, Firefox, WebKit, and mobile emulation, including reconnection, multiple tabs, private results, and expiry without waiting an hour. On Linux, use `npx playwright install --with-deps chromium firefox webkit` when system browser dependencies are missing.

## Architecture

A single Node.js application, written in TypeScript, uses Express and EJS for server-rendered pages and Socket.IO for live updates. It keeps all group data in process memory, with no database or external state store.

Deployment requires one continuously running server process. A restart loses every active group. Multiple application workers are outside the initial design because their memory would not be shared.

## Documentation

Read the [requirements and design specification](docs/superpowers/specs/2026-11-16-secret-santa-design.md) for the user flow, group lifecycle, privacy rules, real-time behavior, and acceptance criteria.

The [implementation plan](docs/superpowers/plans/2026-11-16-secret-santa-implementation.md) breaks delivery into ten tasks, with interfaces, verification steps, and deployment guidance.

The specification distinguishes the original requirements from adopted defaults: 2–50 participants, a fixed participant list, and identity recovery in the same browser. Names are self-selected; people sharing the link must trust one another. Results are final, and clearing a browser session prevents recovering its recipient after drawing.
