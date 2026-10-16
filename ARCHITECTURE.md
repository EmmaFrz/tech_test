# Architecture

## Current scope

This foundation contains the application shell, a typed wire protocol, dependency boundaries and
container entry points. The server currently returns a health response and an empty WebSocket
snapshot. Telemetry generation, reconnect handling, stores, filtering and charts remain to be built.

## Dependency boundaries

`app` composes the application. `features` consumes state, domain functions and UI components. Feature
directories expose their public API through `index.ts`; other features cannot import their internals.

`domain` contains pure logic and may use `lib` and `shared`. `lib` and `shared` have no application
dependencies. `data` can use domain functions and utilities, but cannot import React, components or
stores. `store` can use domain functions and utilities. The application will connect transport and
store actions when ingestion is implemented. `ui` can use utilities but has no dependency on feature
or state code.

These boundaries are checked by `import/no-restricted-paths`. React imports in framework-independent
layers are rejected separately. Cross-feature rules are generated from the feature directories so
new features receive the same restrictions. Tests may import shared fixtures across these boundaries.

Use `@/` for source imports and `@shared/` for the protocol. TypeScript, Vite and ESLint resolve the
same aliases. The server uses protocol imports only as types, so no runtime alias rewriting is needed.

## Protocol and planned ingestion

`shared/protocol.ts` defines readonly node telemetry and the `snapshot`, `delta` and `heartbeat`
message union. CPU and memory use percentages; latency uses milliseconds; timestamps use epoch
milliseconds. Status belongs to the server. A snapshot replaces client state after a connection.

The next data layer will validate messages at the boundary, coalesce updates by node ID and flush
once per animation frame. Stores will preserve unchanged node references. Rows will subscribe by ID,
and ordering will refresh less frequently than cell values. History will live in bounded per-node
buffers outside React. This behavior is planned, not implemented in the scaffold.

## Runtime

The browser will connect to `/ws` on the same origin. nginx forwards the upgrade to `mock-server:4000`;
Vite uses the same route in development. No backend hostname needs to be embedded in client code.

The web image progresses through `deps`, `dev`, `test`, `build` and `runtime`. Checks run before the
production bundle is copied into nginx. nginx listens on port 3000 with its PID and temporary files
under `/tmp` so it can run as an unprivileged user. The server has a separate multi-stage image with
production dependencies only in its runtime stage. Both build from the repository root to access
the lockfile and shared types.

Compose keeps `web` and `mock-server` in the default stack. Development, unit tests and browser tests
use explicit profiles. Health checks control service startup. The configuration avoids a top-level
`version` key and uses features available in Compose v1.28+ and v2.

## Working conventions

- Write code, UI text and documentation in English.
- Use named exports, explicit public return types, readonly data and type-only imports.
- Keep logic out of components and styles in colocated CSS Modules using design tokens.
- Keep TypeScript strict. ESLint rejects `any`, non-null assertions, enums and floating promises.
- Add tests alongside behavior and run formatting, linting, type checks and tests before committing.
- Add dependencies with the npm lockfile. Keep generated output and local tooling out of Git and Docker.
