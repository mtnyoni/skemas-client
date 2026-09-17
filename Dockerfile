FROM oven/bun:1-alpine AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN bun run build

FROM docker.io/oven/bun:distroless AS production
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build --chown=65532:65532 /app/.output ./.output
USER 65532:65532
EXPOSE 3000
CMD [".output/server/index.mjs"]
