# Fleet Ops

A React and TypeScript dashboard for fleet monitoring. The initial scaffold provides the application
shell, a shared telemetry protocol, quality checks and container configuration. Live telemetry, state
management and dashboard features are the next implementation steps.

## Run with Docker

Requires Docker with Compose v2 or Compose v1.28+.

On Windows, Docker Desktop needs a working WSL 2 backend and hardware virtualization enabled.

```sh
docker compose up --build
# Compose v1:
docker-compose up --build
```

Legacy Compose on Docker Engine 29+ also needs `COMPOSE_API_VERSION=1.44` in the shell environment.
The modern `docker compose` command negotiates the API version automatically.

Open <http://localhost:3000>. The `web` service serves the application through nginx; `mock-server`
provides `GET /health` on port 4000 and streams simulated telemetry over `/ws`: a `snapshot` on
connect, a `delta` every tick and a `heartbeat` every 2 seconds.

```sh
docker compose down
```

## Telemetry simulator configuration

The simulator reads these variables, inline or from a `.env` file next to `docker-compose.yml`.
Invalid values stop the server at startup with a descriptive error.

| Variable         | Default | Description                                                          |
| ---------------- | ------- | -------------------------------------------------------------------- |
| `NODE_COUNT`     | `200`   | Number of simulated nodes                                            |
| `TICK_MS`        | `100`   | Milliseconds between delta messages                                  |
| `UPDATE_RATIO`   | `0.3`   | Fraction of nodes that report in each tick                           |
| `SEED`           | `42`    | Seed of the deterministic generator (mulberry32)                     |
| `FORCE_CRITICAL` | `3`     | Nodes pinned to `CRITICAL`, so demos and tests always have some      |
| `DROPOUT_RATIO`  | `0.01`  | Chance per tick that one node goes silent for 12 to 24 seconds       |
| `LOG_LEVEL`      | `info`  | `debug`, `info`, `warn` or `error`; logs are one JSON line per event |

```sh
NODE_COUNT=5000 docker compose up --build
```

Status is derived on the server: `CRITICAL` when CPU ≥ 90 %, memory ≥ 92 % or latency ≥ 800 ms;
`WARNING` when CPU ≥ 75 %, memory ≥ 80 % or latency ≥ 300 ms; otherwise `OK`.

## Development

```sh
docker compose --profile dev up --build web-dev mock-server
```

Open <http://localhost:5173>. Changes in `src/` and `shared/` are mounted into the development container.
Stop that stack with `docker compose --profile dev down`.

For local development, use Node.js 22.12+ and npm:

```sh
npm ci
npm run dev:mock
```

In a second terminal, run `npm run dev`. Vite forwards `/ws` to port 4000. Set `WS_PROXY_TARGET` to
override the development proxy destination.

## Quality checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
npm run test:coverage
npm run build
npm run build:mock
```

`npm run format` applies formatting. `npm test` starts Vitest in watch mode. `npm run preview` serves
the production build on port 3000. `npm run e2e` runs Cypress against that port; `npm run e2e:open`
opens its interactive runner. Set `CYPRESS_baseUrl` to use another application URL.

The initial tests cover the shell and SPA navigation. Telemetry and triage tests will be added with
their features.

```sh
docker compose --profile test run --build --rm unit
docker compose --profile e2e run --build --rm e2e
```

The web image runs formatting, linting, type checks and unit tests before producing the runtime image.
The Cypress image uses the same version as `package.json` and runs as a non-root user.

GitHub Actions builds from a clean checkout with Compose v1 and v2, checks the HTTP routes and
WebSocket proxy, and runs tests inside the containers. The legacy Compose job selects API 1.44
explicitly for compatibility with current Docker Engines.

## Structure

| Path            | Responsibility                                       |
| --------------- | ---------------------------------------------------- |
| `src/app/`      | Application shell, layout and composition            |
| `src/domain/`   | Pure domain calculations                             |
| `src/data/`     | Transport, validation and batching                   |
| `src/store/`    | State and selector hooks                             |
| `src/features/` | Overview, nodes, node detail and connection features |
| `src/ui/`       | Design tokens and reusable components                |
| `src/lib/`      | Framework-independent utilities                      |
| `src/test/`     | Test setup and shared fixtures                       |
| `shared/`       | Client/server wire protocol                          |
| `mock-server/`  | Telemetry service                                    |
| `cypress/`      | Browser journeys                                     |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for dependency rules and implementation boundaries.
