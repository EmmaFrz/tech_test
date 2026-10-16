FROM node:22.23.3-alpine3.23 AS build
WORKDIR /app
ENV CYPRESS_INSTALL_BINARY=0
COPY package.json package-lock.json ./
COPY mock-server/package.json ./mock-server/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY shared ./shared
COPY mock-server ./mock-server
RUN npm run build:mock

FROM node:22.23.3-alpine3.23 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY mock-server/package.json ./mock-server/package.json
RUN npm ci --workspace mock-server --include-workspace-root=false --omit=dev
COPY --from=build --chown=node:node /app/mock-server/dist ./mock-server/dist
USER node
EXPOSE 4000
CMD ["node", "mock-server/dist/mock-server/src/index.js"]
