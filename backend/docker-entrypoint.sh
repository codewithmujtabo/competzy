#!/bin/sh
# Container boot — apply pending DB migrations, then start the server.
#
# Migrations are idempotent (node-pg-migrate tracks applied ones in
# `pgmigrations`), so re-running on every container restart is safe — only
# new entries actually execute. If the migration step fails (DB unreachable,
# a broken migration) we crash here rather than serve a backend that races
# the schema. Coolify restarts the container automatically.
#
# Seeds are deliberately NOT run here — `seed-komodo` and friends create or
# touch data that an environment may not want auto-applied. Run them manually
# via `docker exec` when needed.

set -e

echo "[boot] applying migrations…"
npm run db:migrate --silent
echo "[boot] migrations done — starting server."

exec node dist/index.js
