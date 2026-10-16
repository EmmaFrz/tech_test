FROM node:22.23.3-alpine3.23 AS deps
WORKDIR /app
RUN chown node:node /app
ENV CYPRESS_INSTALL_BINARY=0 \
    NEXT_TELEMETRY_DISABLED=1
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node mock-server/package.json ./mock-server/package.json
USER node
RUN npm ci

FROM deps AS dev
COPY --chown=node:node . .
USER node
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM dev AS test
RUN npm run format:check && npm run lint && npm run typecheck
CMD ["npm", "run", "test:ci"]

FROM test AS build
RUN npm run test:ci && npm run build

FROM node:22.23.3-alpine3.23 AS runtime
WORKDIR /app
RUN chown node:node /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3001
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3001
CMD ["node", "server.js"]
