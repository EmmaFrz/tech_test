FROM cypress/included:16.2.0
WORKDIR /app
RUN mkdir -p /home/node/.cache \
    && cp -a /root/.cache/Cypress /home/node/.cache/Cypress \
    && chown -R node:node /home/node/.cache /app
ENV CYPRESS_CACHE_FOLDER=/home/node/.cache/Cypress
ENV CYPRESS_INSTALL_BINARY=0
COPY package.json package-lock.json ./
COPY mock-server/package.json ./mock-server/package.json
RUN npm ci
COPY --chown=node:node . .
USER node
ENTRYPOINT ["npx", "cypress"]
CMD ["run"]
