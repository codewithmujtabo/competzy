# syntax=docker/dockerfile:1.6

# ── Stage 1: deps ────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
# Native build toolchain for `sharp` (Next image optimization).
RUN apk add --no-cache python3 make g++ \
 && corepack enable && corepack prepare pnpm@11.2.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: build ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.2.2 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public env vars are inlined at build time. Pass via Coolify
# Build Variables (NOT runtime env), or set as Build Args.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Ensure public/ exists even if the project ships none — the runtime stage
# COPYs it unconditionally and would otherwise fail.
RUN mkdir -p public && pnpm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache curl \
 && addgroup -g 1001 -S nodejs \
 && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/ || exit 1

CMD ["node", "server.js"]
