# Fleet Ops

A real-time fleet and operations monitoring dashboard built with Next.js (App Router), React and
TypeScript. It ingests a high-frequency telemetry stream over WebSocket and keeps the interface
responsive while hundreds of nodes update several times per second.

- **Live telemetry** for every node: status, CPU load, memory usage, latency and timestamp.
- **Fleet overview**: active nodes, critical alerts, warnings and average system latency.
- **Node grid** with status filters (live counts), sorting, search by ID and virtualization for
  thousands of rows.
- **Node detail panel** with live charts of utilization and latency over time.
- **Critical-event feedback**: highlighted rows, a brief pulse when a node turns critical, an alert
  state on the overview and the critical count in the browser tab title.
- **Connection awareness**: live, reconnecting or offline state, time since the last update,
  automatic reconnect, and pause and resume of the live view.

## Quick start

**Requirement:** Docker with Docker Compose (v2, or v1.28+). No local Node.js or `node_modules`
needed.

```sh
git clone <repository-url>
cd <repository-folder>
docker-compose up --build        # or: docker compose up --build
```

Open <http://localhost:3000>. This starts three containers:

| Service       | Description                                                                   | Port |
| ------------- | ----------------------------------------------------------------------------- | ---- |
| `web`         | nginx edge: proxies `/ws` to `mock-server` and every other path to `app`      | 3000 |
| `app`         | Next.js server (standalone production build) that renders and serves the page | 3001 |
| `mock-server` | Telemetry simulator streaming over WebSocket, with `GET /health`              | 4000 |

`app` is reachable only through `web`. Stop everything with `docker-compose down`.

Notes:

- On Windows, Docker Desktop needs a working WSL 2 backend and hardware virtualization enabled.
- Legacy `docker-compose` (v1) on Docker Engine 29+ also needs `COMPOSE_API_VERSION=1.44` in the
  shell environment. The modern `docker compose` command negotiates the API version itself.
- Next.js telemetry is disabled in the images and in CI (`NEXT_TELEMETRY_DISABLED=1`). To opt out on
  your own machine, export the same variable or run `npx next telemetry disable`.

## Configuration

The mock server is configured through environment variables, inline or in a `.env` file next to
`docker-compose.yml`. Invalid values stop the server at startup with a descriptive error.

| Variable         | Default | Description                                                          |
| ---------------- | ------- | -------------------------------------------------------------------- |
| `NODE_COUNT`     | `200`   | Number of simulated nodes                                            |
| `TICK_MS`        | `100`   | Milliseconds between update batches                                  |
| `UPDATE_RATIO`   | `0.3`   | Fraction of nodes that report in each batch                          |
| `SEED`           | `42`    | Seed of the deterministic generator (mulberry32)                     |
| `FORCE_CRITICAL` | `3`     | Nodes pinned to `CRITICAL`, so demos and tests always have some      |
| `DROPOUT_RATIO`  | `0.01`  | Chance per batch that one node goes silent for 12 to 24 seconds      |
| `LOG_LEVEL`      | `info`  | `debug`, `info`, `warn` or `error`; logs are one JSON line per event |

Example, a stress test with 5,000 nodes:

```sh
NODE_COUNT=5000 docker-compose up --build
```

The same `SEED` replays the same stream, which makes a reported issue reproducible.

### Status thresholds

The server derives each node's status; the client never recomputes it.

| Status     | Triggered when any of                       |
| ---------- | ------------------------------------------- |
| `CRITICAL` | CPU ≥ 90 %, memory ≥ 92 %, latency ≥ 800 ms |
| `WARNING`  | CPU ≥ 75 %, memory ≥ 80 %, latency ≥ 300 ms |
| `OK`       | otherwise                                   |

A node that has not reported for more than 10 seconds is shown as **stale** and leaves the overview
figures.

## Running tests

Every suite runs inside containers.

### Unit and integration tests (Vitest and Testing Library)

```sh
docker-compose --profile test run --build --rm unit
```

The image first checks formatting, linting and types, then runs the tests with coverage thresholds
(at least 90 % of lines in `domain`, `data` and `store`; at least 70 % overall).

### End-to-end tests (Cypress)

```sh
docker-compose --profile e2e run --build --rm e2e
```

This starts `mock-server`, `app` and `web` if they are not running and executes the suite headlessly
against `http://web:3000`. Every test also fails if the page logs a console error, which catches
hydration problems. Covered journeys:

1. **Critical triage**: filter by `CRITICAL`, open the first node, confirm the panel shows the same
   node ID, its values and a chart, then pause and confirm every visible row is critical.
2. **Sorting**: sort by latency (descending), pause the live view and confirm the order, then resume.

The first run pulls the Cypress image, which is large; later runs reuse it.

## Development

### With Docker (hot reload)

```sh
docker-compose --profile dev up --build web-dev mock-server
```

Open <http://localhost:5173>. `src/`, `shared/` and `next.config.ts` are mounted into the container,
and the Next.js dev server proxies `/ws` to `mock-server` itself. Stop it with
`docker-compose --profile dev down`.

### Locally (optional, Node.js 22.12+)

```sh
npm ci
npm run dev:mock      # telemetry source on port 4000
npm run dev           # in a second terminal; Next.js proxies /ws to localhost:4000
```

Set `WS_PROXY_TARGET` to point the development proxy somewhere else. The proxy exists in development
only: production traffic reaches `/ws` through the nginx edge.

### Scripts

| Script                  | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `npm run dev`           | Next.js dev server on port 5173                           |
| `npm run dev:mock`      | Mock server with reload                                   |
| `npm run build`         | Type-check and production build (standalone, `.next/`)    |
| `npm run build:mock`    | Compile the mock server                                   |
| `npm start`             | Next.js production server on port 3001, without the edge  |
| `npm run typegen`       | Generate the Next.js route types (run by the next two)    |
| `npm run typecheck`     | TypeScript `strict` check of app, server, Cypress, config |
| `npm run lint`          | ESLint with zero warnings allowed                         |
| `npm run format`        | Write Prettier formatting                                 |
| `npm run format:check`  | Verify Prettier formatting                                |
| `npm test`              | Vitest in watch mode                                      |
| `npm run test:ci`       | Vitest single run                                         |
| `npm run test:coverage` | Vitest with a coverage report and thresholds              |
| `npm run e2e`           | Cypress headless (expects the app on `localhost:3000`)    |
| `npm run e2e:open`      | Cypress interactive runner                                |

Set `CYPRESS_baseUrl` to run Cypress against another URL.

## Project structure

```
.
├── Dockerfile               # App image: deps → dev → test → build → runtime (Next.js standalone)
├── docker-compose.yml       # mock-server, app, web (edge), plus profiles dev, test, e2e
├── next.config.ts           # Standalone output, source maps, development-only /ws proxy
├── nginx/                   # Edge image: /ws goes to the mock server, the rest to the app
├── mock-server/             # Telemetry simulator (TypeScript + ws)
├── shared/protocol.ts       # Wire types shared by client and server
├── cypress/                 # End-to-end specs and shared selectors
├── scripts/check-stack.mjs  # Smoke test used by CI: routes, health, telemetry stream
├── src/
│   ├── app/                 # Next.js App Router: root layout, metadata, page, global styles
│   ├── shell/               # Dashboard client island: providers, layout, boundaries, wiring
│   ├── domain/              # Pure logic: filters, sorters, metrics, formatting, chart math
│   ├── data/                # WebSocket client, message guards, batch scheduler
│   ├── store/               # Zustand stores, derived visible list, selector hooks
│   ├── features/            # overview, nodes, node-detail, connection
│   ├── ui/                  # Design tokens and accessible primitives
│   ├── lib/                 # Logger, assertNever, URL resolution, memoizeLast
│   └── test/                # Fixtures, MockWebSocket, store and layout helpers
├── ARCHITECTURE.md
├── CANDIDATE_ID.txt
└── README.md
```

## Architecture at a glance

- **Server-rendered shell, one client island.** The layout and page are Server Components. The
  dashboard is a single client component whose "waiting for data" state is rendered on the server;
  telemetry starts only after hydration.
- **Same-origin WebSocket.** The client connects to `/ws` on whatever host serves it; the nginx edge,
  or the Next.js dev server in development, proxies it to the mock server.
- **Batched ingestion.** Incoming messages are coalesced (latest value per node) and applied to the
  store at most once per animation frame.
- **Fine-grained rendering.** Each grid row subscribes only to its own node, so an update re-renders
  that row and the aggregates, never the whole grid.
- **Responsive input.** Search and the grid render on deferred values; row order refreshes at most
  once per second while values stay live.
- **Virtualized grid** to stay interactive with thousands of nodes.

Design decisions, trade-offs, measurements and the plan for scaling to 10,000+ streaming nodes are
in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Troubleshooting

| Problem                                 | Fix                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| Port 3000 or 4000 already in use        | Stop the other process, or change the host side of the port mapping in `docker-compose.yml` |
| Dashboard shows "Reconnecting"          | Check `docker-compose logs mock-server`; the client retries automatically                   |
| `502 Bad Gateway` from port 3000        | The edge cannot reach `app`; check `docker-compose logs app` and `docker-compose ps`        |
| Stale containers after changes          | `docker-compose down`, then `docker-compose up --build`                                     |
| Cypress image download is slow          | The first `--profile e2e` run pulls the image; later runs reuse it                          |
| Docker engine does not start on Windows | Enable virtualization in the BIOS and the WSL 2 backend in Docker Desktop                   |
