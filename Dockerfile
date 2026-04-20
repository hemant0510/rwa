# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile for Next.js 16 standalone runtime on Azure Container Apps.
# Referenced by deployment/plan.md Phase 1.
#
# Build:
#   docker buildx build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
#     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
#     --build-arg NEXT_PUBLIC_APP_URL=... \
#     --build-arg NEXT_PUBLIC_SENTRY_DSN=... \
#     --build-arg SENTRY_ORG=... \
#     --build-arg SENTRY_PROJECT=... \
#     --build-arg SENTRY_AUTH_TOKEN=... \
#     -t ghcr.io/<owner>/rwa:dev-<sha> .

# ─────────────────────────────────────────────
# Stage 1 — deps: install npm dependencies only
# ─────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# @prisma/adapter-pg is pure-JS over node-postgres, so Alpine needs no build
# toolchain for native compilation. --ignore-scripts skips the husky prepare
# hook and prisma postinstall (prisma generate runs explicitly in the builder).
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ─────────────────────────────────────────────
# Stage 2 — builder: produce the standalone Next.js bundle
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Public build-time args — baked into the client bundle and must be provided
# at build time (not runtime) for NEXT_PUBLIC_* vars to reach browser code.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SENTRY_DSN

# Sentry source-map upload args — consumed by @sentry/nextjs webpack plugin
# during `next build`; never reach the runtime image.
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT \
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The package.json "build" script already runs `prisma generate --schema
# supabase/schema.prisma` before `next build`, so no extra prisma step needed.
RUN npm run build

# ─────────────────────────────────────────────
# Stage 3 — runner: minimal runtime image
# ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root runtime user (uid/gid 1001, Alpine-compatible flags).
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js standalone output ships .next/standalone with a trimmed node_modules
# (including the generated Prisma client traced from src/lib/prisma.ts) plus a
# compiled server.js entrypoint. Static assets and public/ must be copied
# alongside because the standalone server serves them directly.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

USER nextjs

EXPOSE 3000

# Liveness probe target: GET /api/health on this port. Configured on the
# Container App via `az containerapp update --yaml <probes.yaml>`.
CMD ["node", "server.js"]
