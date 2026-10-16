# Architecture

Fleet Ops is a real-time operations dashboard: a Next.js (App Router), React and TypeScript
application that ingests a high-frequency telemetry stream over WebSocket and stays responsive while
hundreds of nodes update several times per second. This document explains how it is put together,
why, what was traded off, and how it would scale to 10,000+ streaming nodes.

## System

```
┌────────────────────────── docker compose ──────────────────────────┐
│                                                                    │
│   ┌──────────────┐  every other path  ┌────────────────────────┐   │
│   │     web      │ ─────────────────▶ │          app           │   │
│   │ nginx :3000  │                    │ Next.js server :3001   │   │
│   │ edge         │                    └────────────────────────┘   │
│   │              │  /ws (proxy)       ┌────────────────────────┐   │
│   │              │ ─────────────────▶ │      mock-server       │   │
│   └──────┬───────┘                    │  Node + ws  :4000      │   │
│          │ http://web:3000            │  seeded telemetry feed │   │
│          │                            └────────────────────────┘   │
│   ┌──────┴───────┐   ┌──────────────┐   ┌───────────────┐          │
│   │ e2e (Cypress)│   │ unit (Vitest)│   │ web-dev       │          │
│   │ profile e2e  │   │ profile test │   │ next dev :5173│          │
│   └──────────────┘   └──────────────┘   │ profile dev   │          │
│                                         └───────────────┘          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Same-origin WebSocket.** The client always connects to `ws(s)://<current host>/ws`. The nginx edge
(and, in development only, the Next.js dev server) proxies that path to `mock-server:4000`. There is
no CORS, no hard-coded host, and the same build works from the host browser (`localhost:3000`) and
from the Cypress container (`web:3000`).

**Wire protocol.** `shared/protocol.ts` defines the types used by both sides. On every connection the
server sends one `snapshot`, then a `delta` per tick with only the nodes that reported, plus a
`heartbeat` every two seconds. The server owns each node's `status`; the client never re-derives it.
The client validates every message with hand-written type guards and drops, logs and counts anything
malformed instead of letting it reach React.

## Why Next.js

The first version was a static single-page app: the browser downloaded an empty `index.html`, then
the JavaScript, and painted nothing before both had run. On Next.js the layout and the page are
Server Components, so the first response already carries the document: title, description, theme
color and the dashboard's real shell in its "waiting for data" state. The App Router also moves
routing into the application instead of an nginx fallback, so `/nodes/node-0042` is a path the app
owns (it does not read it yet, see the trade-offs), and the project gains an application server
that can take on server-side work later without changing the edge.

The wire protocol, the mock server and the domain, data, store, features and ui layers did not
change. The migration was verified against the unchanged Cypress journeys and the render budget
tests. It costs one more service and network hop, a few server-rendering constraints (below) and a
larger toolchain.

## Server shell and client island

- `src/app/layout.tsx` and `src/app/[[...path]]/page.tsx` are Server Components. The layout owns the
  document (`<html lang="en">`), the `metadata` and `viewport` exports and the global styles. The
  optional catch-all route renders the dashboard for every path, so a deep link answers 200 like the
  old SPA fallback did.
- `Dashboard` (`src/shell/Dashboard.tsx`) is the only `'use client'` boundary. Everything below it,
  stores included, is client code that is also rendered on the server for the first response.
- On the server the dashboard renders its empty state: connection `connecting`, zero counts and
  "Waiting for telemetry". The store starts as `connecting` rather than `offline`, so the HTML never
  claims the link is lost before an attempt has been made.
- Telemetry starts only in `useEffect` (`TelemetryProvider`), which never runs on the server. The
  `useSyncExternalStore` subscribers have server snapshots (Zustand's initial state, an empty node
  history), so hydration reproduces the server HTML and the first live snapshot arrives afterwards.
- **Store singleton invariant.** Modules are shared by every request in a Node process, so the
  stores must never be written while rendering; they change only from effects and event handlers.
  A test renders the dashboard on the server and fails if any store changes or telemetry starts.
- The page is dynamic: each request renders the small shell (about 11 kB of HTML, 3 kB compressed)
  and answers `Cache-Control: private, no-cache`. Nothing is cached or written at runtime.
- **Guards.** `serverRender.test.tsx` (Node environment) and `hydration.test.tsx` (the server HTML
  hydrated in jsdom) fail on any mismatch, console error or store write, and
  `cypress/support/e2e.ts` fails an end-to-end test whenever the page logs a console error, which
  covers hydration errors in a real browser.

## Edge

The nginx `web` service is the only published entry point (`localhost:3000`). It proxies `/ws` to
`mock-server:4000` and everything else to `app:3001`, forwarding the upgrade headers on both. The
WebSocket does not go through Next.js in production: the application server renders pages, a
long-lived stream is better terminated by a proxy with its own connection limits and timeouts, and
the entry point stays the same for Cypress, CI and the README. In development `next dev` proxies
`/ws` itself with `rewrites()`, which forwards the upgrade; the rewrite exists in the development
phase only, so it is never baked into the production build. CI runs `scripts/check-stack.mjs` against
the edge and against the dev server, so the two proxies cannot drift apart unnoticed.

## Frontend data flow

```
WebSocket ─▶ TelemetryClient ─▶ decodeServerMessage (guards)
                                      │
              snapshot ───────────────┼───────────────▶ telemetryStore.applySnapshot   (immediate)
                                      │
              delta / heartbeat ─▶ BatchScheduler       latest-wins Map<nodeId, sample>
                                      │                 one flush per animation frame
                                      ▼
                           telemetryStore.applyBatch ──▶ historyStore.record  (ring buffers, outside React)
                                      │
        ┌─────────────────────────────┼──────────────────────────────┐
        ▼                             ▼                              ▼
 useNodeById(id)             useFleetMetrics()            startVisibleNodesSync()
 one row per node            O(n) pass per flush,         filter + sort + search → visibleNodesStore
 re-renders only when        memoized and shared          immediate on UI changes,
 its own node changes        by every subscriber          at most once per second on data changes
```

The wiring lives in `src/shell/startTelemetry.ts`; every other module only knows its neighbours.

## Layers and dependency rules

| Layer       | Responsibility                                                        | May import                     |
| ----------- | --------------------------------------------------------------------- | ------------------------------ |
| `shared/`   | Wire types shared with the server                                     | nothing                        |
| `lib/`      | Logger, `assertNever`, URL resolution, `memoizeLast`                  | nothing from the app           |
| `domain/`   | Pure logic: filters, sorters, metrics, formatting, chart math, buffer | `lib`, `shared`                |
| `data/`     | Transport: client, guards, batch scheduler. No React.                 | `domain`, `lib`, `shared`      |
| `store/`    | Zustand stores, derived list, selector hooks                          | `domain`, `lib`, `shared`      |
| `ui/`       | Design tokens and accessible primitives                               | `lib`                          |
| `features/` | `overview`, `nodes`, `node-detail`, `connection`                      | `store`, `domain`, `ui`, `lib` |
| `shell/`    | `Dashboard` client island: providers, layout, boundaries, telemetry   | everything except `app`        |
| `app/`      | Next.js router: root layout, metadata, page, global styles            | `shell`, design tokens         |

ESLint enforces these with `import/no-restricted-paths`; features additionally can only reach each
other through an `index.ts`. React is banned from `domain`, `data`, `lib` and `shared` by a separate
rule. Because the rules are generated from the feature directories, new features inherit them.

## State strategy

| Store               | Contents                                                               | Changes                      |
| ------------------- | ---------------------------------------------------------------------- | ---------------------------- |
| `telemetryStore`    | `byId`, `connection`, `lastMessageAt`, `serverTime`, `paused`, `epoch` | at most once per frame       |
| `historyStore`      | 120-sample ring buffer per node, `subscribe(nodeId)`                   | only the selected node wakes |
| `uiStore`           | `statusFilter`, `sort`, `search`, `selectedNodeId`                     | user-driven                  |
| `visibleNodesStore` | Ordered list of visible node IDs (derived)                             | see below                    |

Decisions worth knowing:

- **Batching.** Messages land in a latest-wins `Map`; a single `requestAnimationFrame` flushes it.
  rAF pauses in background tabs, so the map stays bounded by the node count and flushes on return.
  Heartbeats travel through the same scheduler, so a frame never causes two store updates.
- **Fine-grained subscriptions.** `NodeRow` is memoized and subscribes to `byId[nodeId]` only.
  `applyBatch` copies the map but keeps the reference of every node that was not updated, so only
  the rows of updated nodes re-render. A test counts renders to prove it (see _Performance_).
- **Derived visible list outside React.** Subscribing the grid to `byId` would re-render it on every
  flush. Instead `startVisibleNodesSync()` subscribes to the stores directly and writes a new `ids`
  array only when membership or order actually changes. Filter, sort, search, pause and a new
  snapshot (`epoch`) recompute immediately; telemetry deltas recompute at most once per second,
  because rows jumping on every tick are unreadable under load. Values inside rows stay live.
- **Responsive input.** `useSyncExternalStore` updates are always synchronous, so wrapping store
  writes in `startTransition` would have no effect. The deferral is applied on the consumer side
  instead: the grid renders `useDeferredValue(ids)`, and the search box echoes keystrokes at once
  while the store receives the deferred value.
- **Pause.** While paused, `applyBatch` merges updates into a non-reactive buffer and only refreshes
  `lastMessageAt`, so the connection indicator stays honest. `resume` applies the newest state per
  node in one update. A snapshot (reconnect) always applies immediately and discards the buffer,
  because it supersedes everything older.
- **History.** Samples are recorded when a batch is applied, so charts freeze with the rest of the
  view while paused and show a straight segment across the gap after resuming.
- **Stale nodes.** A node is stale when the server clock is more than 10 s past its own timestamp.
  The reference is the newest server time seen (heartbeats, snapshots and updates), never the
  browser clock, so clock skew cannot mark healthy nodes stale. Stale nodes leave the overview
  figures; the status filter counts still include them, so each count equals the rows its filter
  lists.

## Connection handling

`TelemetryClient` moves through `connecting → live → reconnecting → offline`. It becomes `live` on
the first valid message (not on socket open), resets its backoff at that point, and retries with
exponential backoff and ±20 % jitter: 0.5 s, 1 s, 2 s … capped at 10 s. After five consecutive failed
attempts it reports `offline` but keeps retrying at the cap. The UI shows the state, the time since
the last flush, and a banner when the connection is lost or the stream goes quiet for more than
three seconds.

## Rendering

- **Virtualization.** `@tanstack/react-virtual` mounts only the visible rows plus an overscan.
  Row height comes from the design tokens (rows are measured), not from a constant in code.
- **Critical escalation.** Critical rows get a red accent and tinted background; a node that
  _enters_ `CRITICAL` pulses for two seconds (disabled under `prefers-reduced-motion`); the Critical
  Alerts card switches to an alert state; the browser tab title carries the count, e.g. `(3) Fleet Ops`.
- **Charts.** Hand-written SVG polylines (`domain/chart.ts` does the math): no charting dependency
  for two small series. Lines differ by style and have a text legend, so color is never the only cue.
- **Error boundaries.** Overview, filters, grid and detail panel each sit in their own boundary, so
  one failing region cannot blank the page.
- **Layout.** At 1280 px and wider the detail panel sits beside the grid. Below that it becomes a
  drawer that starts under the header, so connection status and pause stay reachable.

## Accessibility

Status always appears as icon plus text. The grid is an ARIA `grid` with a roving tab stop: each row
exposes one real `<button>` (Enter activates it natively), and ↑/↓/Home/End/PageUp/PageDown move
focus; Esc closes the detail panel. Filters are native radio inputs, search and sort are labelled
controls, meters expose `role="meter"` with values, and every animation respects
`prefers-reduced-motion`.

## Performance

**Render budget (automated).** `src/shell/renderBudget.test.tsx` drives the real pipeline with a fake
socket and a manual animation-frame clock and asserts that 60 messages in one frame produce exactly
one React commit, that three updated nodes re-render three rows (not the whole window), that a
heartbeat-only frame re-renders no row, and that untouched nodes keep their object reference.

**Stress run (manual).** Production builds of both versions, driven by Cypress 16.2 in headless
Electron (Chromium, Windows 11) behind the same local relay, so the transport is identical. Each run takes three
seconds of warm-up and ten seconds of steady streaming, then nine filter clicks and nine sort changes.
The table pools four alternating runs per build, which gives 36 interactions per cell.

| Fleet size          | Build    | Long tasks (> 50 ms) | Frame interval p50 / p95 / max | Filter click → paint, median / p90 | Sort change → paint, median / p90 |
| ------------------- | -------- | -------------------- | ------------------------------ | ---------------------------------- | --------------------------------- |
| 200 nodes (default) | Vite SPA | 0                    | 6.1 / 18.3 / 33.4 ms           | 22 / 33 ms                         | 29 / 45 ms                        |
| 200 nodes (default) | Next.js  | 0                    | 6.1 / 18.3 / 39.5 ms           | 25 / 36 ms                         | 36 / 60 ms                        |
| 5,000 nodes         | Vite SPA | 0                    | 6.2 / 24.1 / 54.5 ms           | 34 / 68 ms                         | 45 / 102 ms                       |
| 5,000 nodes         | Next.js  | 1                    | 6.1 / 21.3 / 69.4 ms           | 34 / 81 ms                         | 43 / 94 ms                        |

At 5,000 nodes the server emits 1,500 node updates per tick, 15,000 per second. Headless frames are
not vsync-limited, so read the intervals as relative responsiveness rather than a 60 Hz budget.

How to read the comparison:

- **Frames.** The median interval is 6.1 to 6.2 ms in every row. The p95 only ever lands in one of
  two buckets, 18.3 or 24.2 ms, so a difference between those two values is a run falling on the
  other side of the boundary, not a slowdown.
- **Interactions.** Both builds stay far below the 100 ms budget. Single clicks vary a lot between
  runs: at 200 nodes the filter median of the Vite build alone ranged from 19 to 25 ms between runs,
  and the Next.js runs ranged from 19 to 31 ms. The sort median is 7 ms higher with Next.js at 200
  nodes (27 to 42 ms per run against 27 to 31 ms) and level at 5,000 nodes. That difference is real
  but small, and nothing in the application code changed.
- **Long tasks.** In 32 runs with this relay there were none at 200 nodes. At 5,000 nodes one 73 ms
  task appeared in one Vite run and one 69 ms task in one Next.js run, so the load causes them, not
  the framework.
- **Baseline.** The original Vite run of the prototype measured a p95 of 12.2 ms, against 18.3 ms for
  the same build today: the machine state differs between sessions, so only paired runs are compared.

**First load.** The application code is identical; the delivery is not.

| First load                | Vite SPA | Next.js |
| ------------------------- | -------- | ------- |
| Scripts fetched           | 1        | 6       |
| JavaScript transferred    | 289 kB   | 158 kB  |
| JavaScript decoded        | 289 kB   | 526 kB  |
| HTML document transferred | 0.5 kB   | 3.3 kB  |

The previous container served the bundle uncompressed (its nginx had no `gzip`), while the Next.js
server compresses; with gzip enabled the single bundle would be 91 kB against 158 kB. The decoded
size is the one metric that regresses by more than 10 %: the App Router adds its client runtime and
Next.js's vendored React build, about 237 kB to parse on top of the unchanged application. What it
buys is a first response that already contains the shell (see _Server shell and client island_);
neither the frame intervals nor the interactions above moved. Legacy browsers also fetch a 113 kB
polyfill chunk that current browsers skip.

## Testing

- **Unit and integration (Vitest + Testing Library).** Pure domain logic, message guards, the batch
  scheduler (fake frame clock), the client's backoff (fake socket and timers), the stores, the
  derived list, every primitive and every feature, plus server rendering and hydration of the
  dashboard. Coverage thresholds are enforced: ≥ 90 % lines in `domain/`, `data/`, `store/` and ≥ 70 %
  overall.
- **Mock server.** Simulation determinism, bounds, forced critical nodes and dropouts are tested
  without sockets; one integration test covers the real HTTP and WebSocket surface.
- **End to end (Cypress against the full stack).** Critical triage and sorting journeys. The mock
  server is seeded and pins `FORCE_CRITICAL` nodes, so critical data always exists. Assertions are
  retry-able, there are no fixed waits, and the Pause control freezes the grid before order- and
  status-sensitive checks. A support file fails any test during which the page logs a console error.

## Containers and CI

The app image has the stages `deps → dev → test → build → runtime`. `dev` runs `next dev`, `test` runs
formatting, lint and type checks (generating the Next.js types first), `build` runs the unit tests
and `next build`, and `runtime` is `node:22-alpine` with only `.next/standalone` and `.next/static`,
running `node server.js` as the unprivileged `node` user on port 3001. The edge is a separate small
image (`nginx/Dockerfile`) that runs nginx as an unprivileged user. The server image builds with
`tsc` and runs production dependencies only, as a non-root user.

Compose uses no `version:` key and only features available in v1.28+ and v2; `web` waits for `app` and
`mock-server` to be healthy. GitHub Actions builds from a clean checkout with Compose v1 and v2,
checks routes, health and the telemetry stream, verifies that `web`, `app` and `mock-server` do not run
as root, runs the unit tests inside the container, boots the development profile and, in the Compose
v2 job, runs Cypress. `NEXT_TELEMETRY_DISABLED=1` is set in the images and in CI so no build reports
to a third party.

## Trade-offs made for the time box

- **No deep links.** `/nodes/<id>` is served by the optional catch-all route, but the app does not
  read the path to pre-select a node; selection lives in memory only.
- **Every request renders.** The catch-all page is dynamic and uncached. That is cheap for an 11 kB
  shell, and prerendering `/` becomes an option once pages carry real server data.
- **Two React builds.** Unit tests run on React 19.3.1 from npm, while the App Router runs the
  19.3.0 canary that Next.js vendors for the same line. The Cypress journeys, with the console-error
  guard, are what exercise the real runtime.
- **Two proxies.** nginx in production and `rewrites()` in development both carry `/ws`; the shared
  smoke test keeps them equivalent.
- **`npm start` has no edge.** It serves the production build without the `/ws` proxy, and Next.js
  prints a hint that standalone output is meant to run as `node server.js`, which is what the image
  does.
- **Unused native dependency.** The image carries `sharp`, which Next.js traces for image
  optimization although the app has no images.
- **Telemetry opt-out is environment based.** The images and CI set it; a developer's machine needs
  `NEXT_TELEMETRY_DISABLED=1` or `next telemetry disable`.
- **History resolution equals flush rate.** One sample per node per frame at most, and only while
  the view is live. There is no downsampling or persistence.
- **Eager history for every node.** Each node keeps 120 samples. That is cheap at 200 nodes and a few
  tens of megabytes at 5,000; the scaling plan below changes the representation.
- **Times are UTC.** Deterministic output, but not localized.
- **Redux DevTools.** The stores opt into `devtools` in development, which can slow a 5,000-node
  stress run when the extension is installed.
- **Server clock for staleness only.** Latency or timestamps are never corrected for transport delay.
- **Polling the clock in the UI.** "Updated Xs ago" and the quiet-stream banner use small interval
  timers inside their own components.

## Scaling to 10,000+ nodes

The current design batches, virtualizes and keeps rows independent, but it still holds the whole
fleet in memory and scans it per flush. Beyond a few thousand nodes:

1. **Server-side aggregation.** Compute counters, averages and percentiles on the server so the client
   never scans 10k nodes for the overview cards.
2. **Viewport- and filter-scoped subscriptions.** Send full-rate updates only for visible nodes and
   summaries for the rest; the client tells the server what it is looking at.
3. **Compact binary deltas.** MessagePack or Protobuf instead of JSON, with server-side coalescing and
   backpressure (the mock server already drops clients that fall too far behind).
4. **Worker-based ingest.** Parse, sort and filter in a Web Worker and keep history in columnar typed
   arrays; post only the visible window to the main thread.
5. **Canvas or WebGL** for the grid and charts beyond a few thousand rows.
6. **Horizontally scaled gateway.** WebSocket gateways behind pub/sub (NATS, Kafka or Redis Streams),
   with alert deduplication and routing done on the server.

## Working conventions

- Write code, UI text and documentation in English.
- Named exports, explicit public return types, readonly data and type-only imports.
- Logic stays out of components; styles live in colocated CSS Modules that use design tokens only.
- TypeScript is strict. ESLint rejects `any`, non-null assertions, enums, floating promises and
  `console` outside the logger.
- Add tests next to the behavior and run `format:check`, `lint`, `typecheck` and `test:ci` before
  committing; `lint` and `typecheck` generate the Next.js route types themselves.
- Add dependencies through the npm lockfile and keep generated output and local tooling out of Git
  and Docker.
