# Architecture

Fleet Ops is a real-time operations dashboard: a React + TypeScript client that ingests a
high-frequency telemetry stream over WebSocket and stays responsive while hundreds of nodes update
several times per second. This document explains how it is put together, why, what was traded off,
and how it would scale to 10,000+ streaming nodes.

## System

```
┌────────────────────────── docker compose ──────────────────────────┐
│                                                                    │
│   ┌──────────────┐   /ws (proxy)    ┌──────────────────────────┐   │
│   │     web      │ ───────────────▶ │       mock-server        │   │
│   │ nginx :3000  │                  │  Node + ws  :4000        │   │
│   │ static SPA   │                  │  seeded telemetry feed   │   │
│   └──────┬───────┘                  └──────────────────────────┘   │
│          │ http://web:3000                                         │
│   ┌──────┴───────┐   ┌──────────────┐   ┌──────────────┐           │
│   │ e2e (Cypress)│   │ unit (Vitest)│   │ web-dev (Vite)│           │
│   │ profile e2e  │   │ profile test │   │ profile dev  │           │
│   └──────────────┘   └──────────────┘   └──────────────┘           │
└────────────────────────────────────────────────────────────────────┘
```

**Same-origin WebSocket.** The client always connects to `ws(s)://<current host>/ws`. nginx (and the
Vite dev server) proxy that path to `mock-server:4000`. There is no CORS, no hard-coded host, and the
same build works from the host browser (`localhost:3000`) and from the Cypress container
(`web:3000`).

**Wire protocol.** `shared/protocol.ts` defines the types used by both sides. On every connection the
server sends one `snapshot`, then a `delta` per tick with only the nodes that reported, plus a
`heartbeat` every two seconds. The server owns each node's `status`; the client never re-derives it.
The client validates every message with hand-written type guards and drops, logs and counts anything
malformed instead of letting it reach React.

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
| `shell/`    | Composition: providers, layout, error boundaries, telemetry wiring    | everything                     |

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

**Stress run (manual).** Production build served by `vite preview`, driven by Cypress 16.2 in
headless Chromium (Windows 11). Ten seconds of steady streaming after a three-second warm-up:

| Fleet size          | Long tasks (> 50 ms) | Frame interval p50 / p95 / max | Filter click → paint | Sort change → paint |
| ------------------- | -------------------- | ------------------------------ | -------------------- | ------------------- |
| 200 nodes (default) | 0                    | 6.1 / 12.2 / 84.8 ms           | 22 ms                | 11 ms               |
| 5,000 nodes         | 0                    | 6.1 / 12.2 / 36.1 ms           | 26 ms                | 32 ms               |

At 5,000 nodes the server emits 1,500 node updates per tick, 15,000 per second. Headless
frames are not vsync-limited, so read the intervals as relative responsiveness rather than a 60 Hz
budget; the point is that moving from 200 to 5,000 nodes does not produce long tasks.

## Testing

- **Unit and integration (Vitest + Testing Library).** Pure domain logic, message guards, the batch
  scheduler (fake frame clock), the client's backoff (fake socket and timers), the stores, the
  derived list, every primitive and every feature. Coverage thresholds are enforced: ≥ 90 % lines in
  `domain/`, `data/`, `store/` and ≥ 70 % overall.
- **Mock server.** Simulation determinism, bounds, forced critical nodes and dropouts are tested
  without sockets; one integration test covers the real HTTP and WebSocket surface.
- **End to end (Cypress against the full stack).** Critical triage and sorting journeys. The mock
  server is seeded and pins `FORCE_CRITICAL` nodes, so critical data always exists. Assertions are
  retry-able, there are no fixed waits, and the Pause control freezes the grid before order- and
  status-sensitive checks.

## Containers and CI

The web image has the stages `deps → dev → test → build → runtime`; the `test` stage runs
formatting, lint and type checks, `build` runs the unit tests, and `runtime` is nginx running as an
unprivileged user. The server image builds with `tsc` and runs production dependencies only, as a
non-root user. Compose uses no `version:` key and only features available in v1.28+ and v2. GitHub
Actions builds from a clean checkout with Compose v1 and v2, checks routes, health and the telemetry
stream, runs the unit tests inside the container, boots the development profile and, in the Compose v2 job, runs Cypress.

## Trade-offs made for the time box

- **No deep links.** `/nodes/<id>` is served by the SPA fallback, but the app does not read the path
  to pre-select a node; selection lives in memory only.
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
  committing.
- Add dependencies through the npm lockfile and keep generated output and local tooling out of Git
  and Docker.
