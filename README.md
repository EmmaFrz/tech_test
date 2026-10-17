# Fleet Ops

Fleet Ops is a real-time dashboard for monitoring a fleet of servers. A small simulator streams
telemetry over WebSocket, and the dashboard shows the health of every node as it changes, makes
critical events stand out and stays responsive while thousands of nodes update several times per
second.

Built with React, TypeScript, Vite and Zustand. Runs with a single Docker Compose command.

## Features

- Live status, CPU, memory and latency for every node.
- Fleet overview: active nodes, critical alerts, warnings and average latency.
- Node grid with status filters, sorting, search by ID and virtualized rows.
- Detail panel with live charts for the selected node.
- Critical alerts that are hard to miss, including the count in the browser tab title.
- Connection status with automatic reconnect, plus pause and resume of the live view.
- Keyboard accessible; status is never shown by color alone.

## Getting started

### Requirements

- [Docker](https://docs.docker.com/get-docker/) with Docker Compose (v2, or v1.28+).
- Node.js 22.12+ only if you want to run the project outside Docker.

### Run with Docker

```sh
git clone <repository-url>
cd <repository-folder>
docker-compose up --build        # or: docker compose up --build
```

Open <http://localhost:3000>. The first build takes a few minutes because it also runs the checks
and unit tests. Two services start:

| Service       | What it does                                           | Port |
| ------------- | ------------------------------------------------------ | ---- |
| `web`         | The dashboard, served by nginx, which proxies `/ws`    | 3000 |
| `mock-server` | Telemetry simulator that streams updates via WebSocket | 4000 |

Stop everything with `docker-compose down`.

With the legacy `docker-compose` v1 on Docker Engine 29+, also set `COMPOSE_API_VERSION=1.44` in
your shell. The ports listen on `127.0.0.1` only; set `BIND_ADDRESS=0.0.0.0` to reach them from
other machines.

### Configure the simulator

Copy [`.env.example`](./.env.example) to `.env` and change what you need, or set the variables
inline:

| Variable         | Default | Description                                          |
| ---------------- | ------- | ---------------------------------------------------- |
| `NODE_COUNT`     | `200`   | Number of simulated nodes                            |
| `TICK_MS`        | `100`   | Milliseconds between update batches                  |
| `UPDATE_RATIO`   | `0.3`   | Fraction of nodes that report in each batch          |
| `SEED`           | `42`    | Random seed; the same seed replays the same stream   |
| `FORCE_CRITICAL` | `3`     | Nodes kept in the critical state                     |
| `DROPOUT_RATIO`  | `0.01`  | Chance per batch that a node goes silent for a while |
| `LOG_LEVEL`      | `info`  | `debug`, `info`, `warn` or `error`                   |

For example, a stress test with 5,000 nodes:

```sh
NODE_COUNT=5000 docker-compose up --build
```

## Development

Run with hot reload inside Docker, then open <http://localhost:5173>:

```sh
docker-compose --profile dev up --build web-dev mock-server
```

Or run it directly with Node.js:

```sh
npm ci
npm run dev:mock      # simulator on port 4000
npm run dev           # in a second terminal: dashboard on http://localhost:5173
```

Other useful scripts: `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format` and
`npm run test:ci`. See `package.json` for the full list.

## Tests

Both suites run inside containers:

```sh
docker-compose --profile test run --build --rm unit   # format, lint, types, unit tests, coverage
docker-compose --profile e2e run --build --rm e2e     # end-to-end tests with Cypress
```

The first end-to-end run downloads the Cypress image, which is large. Outside Docker, use
`npm run test:ci` for unit tests and `npm run e2e` with the app running on port 3000.

## What was built

The goal was a dashboard that keeps up with a fast telemetry stream without freezing, with code that
is easy to follow and test.

- **Simulator.** A deterministic Node.js WebSocket server sends a full snapshot on connect, then
  only the nodes that changed. It decides each node's status, so the client never recomputes it.
- **Fast updates.** Incoming messages are batched and applied at most once per animation frame. Each
  grid row listens only to its own node, so one update redraws one row, and the grid renders only
  the rows on screen.
- **Clear layers.** Pure logic (`domain`), transport and validation (`data`), state (`store`) and UI
  (`features`, `ui`) are separate, with wire types shared between client and server.
- **Resilience.** Invalid messages are dropped, the client reconnects on its own, and nginx finds
  the simulator again if its container is recreated.
- **Quality.** Strict TypeScript, ESLint and Prettier, unit, integration and end-to-end tests with
  coverage thresholds, and CI that builds and tests the stack with Compose v1 and v2.

Design decisions, trade-offs and the plan for scaling to 10,000+ nodes are in
[ARCHITECTURE.md](./ARCHITECTURE.md).

### Project structure

```
.
├── src/                 # Dashboard: app, domain, data, store, features, ui, lib
├── mock-server/         # Telemetry simulator
├── shared/              # Wire protocol types shared by client and server
├── cypress/             # End-to-end tests
├── nginx/               # Web server and /ws proxy configuration
├── scripts/             # Checks used by CI
├── Dockerfile
└── docker-compose.yml
```

## Contributing

1. Create a branch from `main`.
2. Make your change and add tests for it.
3. Run the checks: `npm run format:check`, `npm run lint`, `npm run typecheck` and
   `npm run test:ci`.
4. Commit with [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
   `docs:`) and open a pull request. CI builds the stack and runs every test suite.

Code, comments and documentation are written in English. More conventions are in
[ARCHITECTURE.md](./ARCHITECTURE.md#working-conventions).

## Troubleshooting

| Problem                          | Fix                                                                     |
| -------------------------------- | ----------------------------------------------------------------------- |
| Port 3000 or 4000 already in use | Stop the other process, or change the host port in `docker-compose.yml` |
| The dashboard keeps reconnecting | Check `docker-compose logs mock-server`                                 |
| Old version shown after changes  | Run `docker-compose down`, then `docker-compose up --build`             |
| Docker does not start on Windows | Enable virtualization and the WSL 2 backend in Docker Desktop           |

## License

No license has been chosen for this project yet, so default copyright applies until one is added.
