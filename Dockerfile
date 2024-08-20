### Stage 1: Build
FROM node:22-alpine AS base
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
RUN npm install -g pnpm
RUN apt-get update && apt-get install -y ffmpeg

### Stage 2: Download dependencies
FROM base AS dependencies
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
WORKDIR /app
COPY package.json pnpm-lock.yaml tsconfig.build.json tsconfig.json ./
RUN pnpm install

### Stage 3: Build + Delete dev dependencies
FROM base AS build
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
WORKDIR /app
COPY . .
COPY --from=dependencies /app/node_modules ./node_modules
RUN pnpm build
RUN pnpm prune --prod
RUN pnpm remove-declaration

### Stage 4: Final
FROM base AS deploy
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
WORKDIR /app
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/nest-cli.json ./nest-cli.json
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/tsconfig.build.json ./tsconfig.build.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 5000
CMD ["pnpm", "start:prod"]
