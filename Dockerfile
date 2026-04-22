FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.8.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/api/package.json packages/api/
COPY packages/auth/package.json packages/auth/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG BYTESAIL_VERSION=dev
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/web/node_modules apps/web/node_modules
COPY . .
ENV BYTESAIL_VERSION=${BYTESAIL_VERSION}
RUN pnpm --filter @bytesail/web build

FROM base AS runtime
ARG BYTESAIL_VERSION=dev
LABEL org.opencontainers.image.source="https://github.com/Eldritch-Logic/bytesail"
LABEL org.opencontainers.image.description="Self-hosted PaaS platform"
LABEL org.opencontainers.image.version="${BYTESAIL_VERSION}"
ENV NODE_ENV=production
ENV BYTESAIL_VERSION=${BYTESAIL_VERSION}
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/apps/web/build apps/web/build
COPY --from=build /app/apps/web/package.json apps/web/
COPY --from=build /app/packages packages
EXPOSE 3000
CMD ["node", "apps/web/build"]
