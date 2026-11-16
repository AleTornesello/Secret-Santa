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

## Proposed architecture

A single Node.js application, written in TypeScript, uses Express and EJS for server-rendered pages and Socket.IO for live updates. It keeps all group data in process memory, with no database or external state store.

Deployment requires one continuously running server process. A restart loses every active group. Multiple application workers are outside the initial design because their memory would not be shared.

## Documentation

Read the [requirements and design specification](docs/superpowers/specs/2026-11-16-secret-santa-design.md) for the user flow, group lifecycle, privacy rules, real-time behavior, and acceptance criteria.

The [implementation plan](docs/superpowers/plans/2026-11-16-secret-santa-implementation.md) breaks delivery into ten tasks, with interfaces, verification steps, and deployment guidance.

The specification distinguishes confirmed requirements from proposed defaults. This repository currently contains documentation only; installation and run instructions will be added when the application is implemented.
