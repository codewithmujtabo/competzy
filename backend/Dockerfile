# syntax=docker/dockerfile:1.6

# ── Stage 1: build TypeScript ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Native build toolchain for bcrypt / pdfkit / sharp-style deps.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations

RUN npm run build && npm prune --omit=dev

# ── Stage 2: runtime ─────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache tini curl \
 && addgroup -g 1001 -S nodejs \
 && adduser -S nodejs -u 1001 -G nodejs

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/migrations ./migrations
COPY --chown=nodejs:nodejs package.json ./

RUN mkdir -p /app/uploads && chown -R nodejs:nodejs /app/uploads
VOLUME ["/app/uploads"]

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
