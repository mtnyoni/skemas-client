FROM node:25-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

# FROM docker.io/oven/bun:distroless AS production
# WORKDIR /app
# ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
# COPY --from=build --chown=65532:65532 /app/.output ./.output
# USER 65532:65532
# EXPOSE 3000
# CMD [".output/server/index.mjs"]

FROM gcr.io/distroless/nodejs22-debian12 AS production
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build --chown=nonroot:nonroot /app/.output ./.output
USER nonroot
EXPOSE 3000
CMD [".output/server/index.mjs"]
