## Builder container
FROM node:lts-bullseye-slim AS builder

WORKDIR /home/node/app

# Dependency specifications
COPY ./package.json ./yarn.lock ./
RUN yarn install

COPY . .

# Build application to `out/`
RUN yarn build

## Target container
FROM node:lts-bullseye-slim AS target
WORKDIR /opt/app
COPY --from=builder /home/node/app/openapi ./openapi
COPY --from=builder /home/node/app/migrations ./migrations
COPY --from=builder /home/node/app/out ./out
COPY --from=builder /home/node/app/node_modules ./out/node_modules
ENV PORT=8000
EXPOSE ${PORT}
ENTRYPOINT [ "node", "/opt/app/out/index.js" ]
