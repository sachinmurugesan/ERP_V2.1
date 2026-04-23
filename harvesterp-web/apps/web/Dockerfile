# ============================================
# Next.js 15 — Development Dockerfile
# Minimal dev image for the strangler-fig Docker Compose stack.
#
# IMPORTANT: This Dockerfile is designed for docker-compose dev use only.
# The build context is the harvesterp-web monorepo root (../harvesterp-web),
# not apps/web/, so that pnpm workspace packages (packages/lib, packages/sdk)
# are reachable during `pnpm install`.
#
# Production builds should use a multi-stage Dockerfile with `next build` +
# `next start` — that is out of scope for Task 9.
# ============================================
FROM node:20-alpine

# Enable corepack so `pnpm` is available without a separate install step
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /workspace

EXPOSE 3000

# CMD is overridden by docker-compose to run `pnpm install && pnpm --filter @harvesterp/web dev`
CMD ["sh", "-c", "pnpm install --frozen-lockfile && pnpm --filter @harvesterp/web dev"]
