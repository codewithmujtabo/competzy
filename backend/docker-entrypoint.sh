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
# Call node-pg-migrate directly instead of via `pnpm run db:migrate`.
# pnpm 11.3+ runs a `runDepsStatusCheck` before every `pnpm run X` which
# writes a temp file to the CWD (`/app/_tmp_...`); the runtime container's
# `/app` directory is root-owned (we only chown individual files), so the
# nodejs user gets EACCES and the entrypoint crashes in a restart loop.
# `node-pg-migrate` binary in `node_modules/.bin/` works the same with no
# package-manager involvement.
node_modules/.bin/node-pg-migrate up --migrations-dir migrations
echo "[boot] migrations done — starting server."

exec node dist/index.js
