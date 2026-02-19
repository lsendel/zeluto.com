FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/process-lib/package.json packages/process-lib/
COPY packages/domain-kernel/package.json packages/domain-kernel/
COPY packages/domains/scoring-domain/package.json packages/domains/scoring-domain/
COPY services/scoring-engine/package.json services/scoring-engine/
RUN pnpm install --frozen-lockfile --filter @mauntic/scoring-engine-service...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/process-lib/node_modules ./packages/process-lib/node_modules
COPY --from=deps /app/packages/domain-kernel/node_modules ./packages/domain-kernel/node_modules
COPY . .
RUN pnpm --filter @mauntic/scoring-engine-service build

FROM base AS runtime
COPY --from=build /app/services/scoring-engine/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "dist/index.js"]
