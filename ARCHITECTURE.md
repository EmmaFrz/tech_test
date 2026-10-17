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
(`web:3000`). nginx resolves `mock-server` through Docker's DNS at runtime (`resolver` plus an
upstream with `resolve`), so a recreated backend on a new address is reached without a reload; CI
recreates the backend on a new address and checks that a connected client gets a fresh snapshot.

**Wire protocol.** `shared/protocol.ts` defines the types used by both sides. On every connection the
server sends one `snapshot`, then a `delta` per tick with only the nodes that reported, plus a
`heartbeat` every two seconds. The server owns each node's `status`; the client never re-derives it.
The client validates every message with hand-written type guards and drops, logs and counts anything
malformed instead of letting it reach React. Node timestamps and heartbeat times must be epoch
milliseconds between 1970 and the end of year 9999: anything else could not be formatted and would
move the server clock, and so staleness, out of reach. Latencies must lie between 0 and one hour:
finite values near `Number.MAX_VALUE` would overflow the fleet average and the chart axis, while an
hour keeps the latency sum of any fleet exact.

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

The wiring lives in `src/app/startTelemetry.ts`; every other module only knows its neighbours.

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
| `app/`      | Composition: providers, layout, error boundaries, telemetry wiring    | everything                     |

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
- **Prototype-free node maps.** The protocol accepts any non-empty node ID, so `byId` (and every
  other map keyed by node ID) has no prototype: IDs such as `__proto__`, `constructor` or
  `toString` are ordinary keys that can neither resolve to inherited values nor replace the
  prototype. `createDictionary` in `lib/` builds them, and tests check every update path.
- **Derived visible list outside React.** Subscribing the grid to `byId` would re-render it on every
  flush. Instead `startVisibleNodesSync()` subscribes to the stores directly and writes a new `ids`
  array only when membership or order actually changes. Filter, sort, search, pause and a new
  snapshot (`epoch`) recompute immediately; telemetry deltas recompute at most once per second,
  because rows jumping on every tick are unreadable under load. Values inside rows stay live. A
  refresh that falls due between two flushes is handed to the batch scheduler and runs inside the
  next animation frame, so a reorder always shares the commit of that frame's telemetry.
- **Responsive input.** `useSyncExternalStore` updates are always synchronous, so wrapping store
  writes in `startTransition` would have no effect. The search box echoes keystrokes at once while
  the store receives a deferred value. A filter, sort or search change also keeps the list it
  replaces and bumps a revision: the grid renders the old list until a `useDeferredValue` pass on
  that revision renders the new one, so the control responds in the first frame. Telemetry reorders
  leave the revision alone and render in the commit of their flush, because deferring them would
  split every reorder into a second commit.
- **Pause.** While paused, `applyBatch` merges updates into a non-reactive buffer and only refreshes
  `lastMessageAt`, so the connection indicator stays honest. `resume` applies the newest state per
  node in one update. A snapshot (reconnect) always applies immediately and discards the buffer,
  because it supersedes everything older.
- **History.** Samples are recorded when a batch is applied, so charts freeze with the rest of the
  view while paused and show a straight segment across the gap after resuming. A snapshot is
  recorded as the whole fleet: histories of nodes it no longer lists are dropped, and a history
  whose clock it moves backwards (a different server session) restarts. A reconnect to the same
  session continues every history, without duplicating the sample of a node that stayed silent.
- **Critical entries.** The time a node moves from another status into `CRITICAL` is kept in the
  store for the two seconds of its pulse, outside the row, so a row that only appears later (a
  filter or a scroll reveals it) still pulses. A node's first appearance is never an entry, so the
  first snapshot does not pulse; entries expire on the first flush after their window.
- **Stale nodes.** A node is stale when the server clock is more than 10 s past its own timestamp.
  The reference is the newest server time seen (heartbeats, snapshots and updates), never the
  browser clock, so clock skew cannot mark healthy nodes stale. Stale nodes leave the overview
  figures; the status filter counts still include them, so each count equals the rows its filter
  lists.

## Connection handling

`TelemetryClient` moves through `connecting → live → reconnecting → offline`. It becomes `live` on
the first valid message (not on socket open), resets its backoff at that point, and retries with
exponential backoff and ±20 % jitter: 0.5 s, 1 s, 2 s, 4 s. The fifth consecutive failure reports
`offline`, and from then on every retry waits the 10 s cap. The UI shows the state, the time since
the last flush, and a banner when the connection is lost or the stream goes quiet for more than
three seconds.

A socket can also stay open while nothing useful arrives: a half-open connection, a stalled
network path, or a peer that only sends invalid messages. A watchdog therefore treats the
connection as failed when no valid message arrives within 15 s of opening the socket or 10 s of
the previous valid message (five missed heartbeats), closes the socket and goes through the same
retry policy. Only valid messages re-arm it, on receipt rather than in the animation-frame flush,
so a background tab whose frames are paused does not trip it; background timer throttling can only
delay the check.

## Rendering

- **Virtualization.** `@tanstack/react-virtual` mounts only the visible rows plus four rows past
  each edge. Row height comes from the design tokens, not from a constant in code: a ResizeObserver
  reports it, and a newly mounted row takes the last reported height, because measuring each new
  row would force a layout during the commit.
- **Critical escalation.** Critical rows get a red accent and tinted background; a node that
  _enters_ `CRITICAL` pulses for two seconds (disabled under `prefers-reduced-motion`), including
  when its row only appears because a filter now lists it; the Critical Alerts card switches to an
  alert state; the browser tab title carries the count, e.g. `(3) Fleet Ops`.
- **Charts.** Hand-written SVG polylines (`domain/chart.ts` does the math): no charting dependency
  for two small series. Lines differ by style and have a text legend, so color is never the only cue.
- **Error boundaries.** Overview, filters, grid and detail panel each sit in their own boundary, so
  one failing region cannot blank the page.
- **Layout.** At 1280 px and wider the detail panel sits beside the grid. Below that it becomes a
  drawer positioned against `<main>`, which starts under the header however tall the header wraps
  (narrow widths, larger text, longer labels), so connection status and Pause stay reachable.
  The status filters, search and sort controls wrap instead of running past the window's edge. The
  grid takes the height left under them but never less than 16rem (or the window, if shorter):
  when a narrow or short window, or large text, leaves less, the page scrolls instead. The grid's
  region uses size containment, so the virtual canvas never asks the page for its full height.

## Accessibility

Status always appears as icon plus text. The grid is an ARIA `grid` with a roving tab stop: each row
exposes one real `<button>` (Enter activates it natively), and ↑/↓/Home/End/PageUp/PageDown move
focus; Esc closes the detail panel. Filters are native radio inputs, search and sort are labelled
controls, meters expose `role="meter"` with values, and every animation respects
`prefers-reduced-motion`.

Live data never strands keyboard focus. A row that leaves the rendered window (reorder, filter,
snapshot) takes its focus with it, and a row that React moves can lose it in some browsers, so after
each commit the grid gives focus back to the row that had it; when that row is gone, the grid itself
takes focus and the arrow keys continue from the gap the row left. Focus that the user placed outside
the grid is left alone.

Below 1280 px the open drawer takes focus, and the regions it covers (overview, filters, grid)
become `inert`, so Tab and Shift+Tab move between the header controls and the drawer only. Closing
it with Close, Esc or the backdrop returns focus to the node's row, scrolled into view, or to the
grid when the row has left the list; focus already moved elsewhere stays there. When the page
scrolls, opening the drawer brings its top into the window, and closing it brings the row back.

## Performance

**Render budget (automated).** `src/app/renderBudget.test.tsx` drives the real pipeline with a fake
socket and a manual animation-frame clock and asserts that 60 messages in one frame produce exactly
one React commit, that three updated nodes re-render three rows (not the whole window), that a
heartbeat-only frame re-renders no row, and that untouched nodes keep their object reference. It
also covers order and membership changes: a flush that reorders the rows, a reorder that falls due
between flushes (with and without telemetry in its frame) and a node entering the active filter
each produce exactly one commit in their frame. The "updated Xs ago" indicators tick on their own
timers and are outside this budget.

**Stress run (manual).** Production build served by `vite preview`, driven by Cypress 16.2 in
headless Chromium (Windows 11). Ten seconds of steady streaming after a three-second warm-up:

| Fleet size          | Long tasks (> 50 ms) | Frame interval p50 / p95 / max | Filter click → paint | Sort change → paint |
| ------------------- | -------------------- | ------------------------------ | -------------------- | ------------------- |
| 200 nodes (default) | 0                    | 6.1 / 12.2 / 84.8 ms           | 22 ms                | 11 ms               |
| 5,000 nodes         | 0                    | 6.1 / 12.2 / 36.1 ms           | 26 ms                | 32 ms               |

At 5,000 nodes the server emits 1,500 node updates per tick, 15,000 per second. Headless
frames are not vsync-limited, so read the intervals as relative responsiveness rather than a 60 Hz
budget; the point is that moving from 200 to 5,000 nodes does not produce long tasks.

Those numbers predate the rendering changes made after the code review: a reorder shares the commit
of its flush, the sort compares precomputed ID ranks instead of collating IDs on every tie (IDs the
collator considers equal, such as `node-01` and `node-1`, share a rank and keep their order), new rows
take the observed row height instead of being measured, the overscan dropped from eight rows per
edge to four, and the grid follows a filter, sort or search change in a deferred pass. A paired
comparison against the submitted build (both behind nginx on the same 5,000-node stream, headless
Electron, alternating runs, medians of the per-run medians):

| Interaction                        | First paint          | Grid shows the result |
| ---------------------------------- | -------------------- | --------------------- |
| Filter click (5 runs of 9 clicks)  | 19 ms (26 ms before) | 34 ms (39 ms before)  |
| Sort change (6 runs of 21 changes) | 18 ms (27 ms before) | 34 ms (42 ms before)  |

In the five-run comparison, its nine sort changes per run showed the new order 3 ms later than
before (37 ms against 34 ms), which is within the spread between runs, while their first paint still
came earlier (24 ms against 26 ms).

## Testing

- **Unit and integration (Vitest + Testing Library).** Pure domain logic, message guards, the batch
  scheduler (fake frame clock), the client's backoff and watchdog (fake socket and timers), the
  stores with a real history, the derived list, every primitive and every feature. Coverage
  thresholds (≥ 90 % lines in `domain/`, `data/`, `store/`, ≥ 70 % overall) are enforced by the
  Docker build and by the `unit` profile, so CI fails when coverage drops.
- **Mock server.** Simulation determinism, bounds, forced critical nodes and dropouts are tested
  without sockets; integration tests cover the real HTTP and WebSocket surface, and subprocess
  tests cover a startup on a taken port through the real entry point.
- **End to end (Cypress against the full stack).** Critical triage and sorting journeys. The mock
  server is seeded and pins `FORCE_CRITICAL` nodes, so critical data always exists. Assertions are
  retry-able, there are no fixed waits, and the Pause control freezes the grid before order- and
  status-sensitive checks. Three more specs replace the WebSocket with a deterministic in-page source
  to check keyboard focus in the drawer and the live grid, the wrapped-header layout at 375 px
  (normal and 200 % text), the critical pulse with and without reduced motion, and that filters,
  search, sort and a grid with reachable rows survive narrow and short windows and 200 % text.
- **CI scripts.** The recovery check's reconnecting client is tested against a proxy that rejects
  handshakes, as nginx does while the backend is away; the Docker build runs it on Node 22.

## Containers and CI

The web image has the stages `deps → dev → test → build → runtime`; the `test` stage runs
formatting, lint and type checks, `build` runs the unit tests with coverage thresholds, and
`runtime` is nginx running as an unprivileged user. The server image builds with `tsc` and runs
production dependencies only, as a non-root user. Compose uses no `version:` key and only features
available in v1.28+ and v2. GitHub Actions builds from a clean checkout with Compose v1 and v2,
checks routes, health and the telemetry stream, recreates the backend on a new address and checks
that a connected client recovers through nginx (it retries after a rejected handshake, which Node 22
reports with an `error` event and no `close`), runs the unit tests inside the container, boots
the development profile and, in the Compose v2 job, runs Cypress.

Local leftovers of the Next.js migration branch (`.next/`, `next-env.d.ts`) are ignored by Git,
Docker, Prettier and ESLint, so switching branches does not break checks or builds.

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
  The client trusts the server's clock within the accepted range; a plausible but wrong future time
  would still mark nodes stale until the next snapshot.
- **Pulse window.** Critical entries expire on the first flush after their two seconds, and a row
  that appears inside that window plays the full pulse from when it appears.
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
