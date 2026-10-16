FROM node:22.23.3-alpine3.23 AS deps
WORKDIR /app
RUN chown node:node /app
ENV CYPRESS_INSTALL_BINARY=0
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
CMD ["npm", "run", "test:coverage"]

FROM test AS build
RUN npm run test:coverage && npm run build

FROM nginx:1.30.6-alpine3.24 AS runtime
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
