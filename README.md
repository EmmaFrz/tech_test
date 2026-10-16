# Fleet Ops

A React and TypeScript dashboard for fleet monitoring. The initial scaffold provides the application
shell, a shared telemetry protocol, quality checks and container configuration. Live telemetry, state
management and dashboard features are the next implementation steps.

## Run with Docker

Requires Docker with Compose v2 or Compose v1.28+.

```sh
docker compose up --build
# Compose v1:
docker-compose up --build
```

Open <http://localhost:3000>. The `web` service serves the application through nginx; `mock-server`
provides `GET /health` on port 4000 and accepts `/ws` connections with an empty snapshot. The telemetry
simulation is not implemented yet.

```sh
docker compose down
```

## Development

```sh
docker compose --profile dev up --build web-dev mock-server
```

Open <http://localhost:5173>. Changes in `src/` and `shared/` are mounted into the development container.

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
