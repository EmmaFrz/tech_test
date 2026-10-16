FROM node:22.23.3-alpine3.23 AS deps
WORKDIR /app
ENV CYPRESS_INSTALL_BINARY=0
COPY package.json package-lock.json ./
COPY mock-server/package.json ./mock-server/package.json
RUN npm ci && chown node:node /app

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

FROM nginx:1.30.6-alpine3.24 AS runtime
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
