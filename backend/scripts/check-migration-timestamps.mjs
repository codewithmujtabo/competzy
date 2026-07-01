#!/usr/bin/env node
// Guards backend/migrations/ against duplicate (and malformed) timestamps.
//
// Why this exists: node-pg-migrate runs migrations on container boot and orders
// them by their 13-digit timestamp prefix. Two files sharing a timestamp is a
// latent footgun — the moment one of the pair is applied and the other isn't,
// `checkOrder` throws on every boot and the backend crash-loops. That took prod
// down on 2026-07-01 (two "phone unique" migrations both stamped 1753100000000).
// This check fails BEFORE such a pair can merge.
//
// Dependency-free (pure Node) so CI needs nothing but `node`.
// Run locally: `pnpm --dir backend check:migrations` (or `node scripts/check-migration-timestamps.mjs`)

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

// Pre-existing duplicates that are already applied on EVERY environment and are
// therefore harmless (checkOrder only trips when one of a same-timestamp pair
// is still un-run; these ran together long ago). Do NOT add entries here to
// silence a NEW collision — bump the new migration's timestamp instead.
const GRANDFATHERED = new Set(['1745600000000']);

const TIMESTAMP_RE = /^(\d{13})_.+\.sql$/;

const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

const byTimestamp = new Map();
const malformed = [];
for (const f of files) {
  const m = TIMESTAMP_RE.exec(f);
  if (!m) {
    malformed.push(f);
    continue;
  }
  const ts = m[1];
  const group = byTimestamp.get(ts) ?? [];
  group.push(f);
  byTimestamp.set(ts, group);
}

const problems = [];
for (const [ts, group] of byTimestamp) {
  if (group.length > 1 && !GRANDFATHERED.has(ts)) {
    problems.push(`Duplicate timestamp ${ts} across ${group.length} files:\n      - ${group.join('\n      - ')}`);
  }
}
if (malformed.length) {
  problems.push(`Malformed filename(s) — expected <13-digit-timestamp>_<name>.sql:\n      - ${malformed.join('\n      - ')}`);
}

if (problems.length) {
  console.error('\n  ✗ Migration check FAILED:\n');
  for (const p of problems) console.error('    ' + p + '\n');
  console.error(
    '  Two migrations with the same timestamp crash the backend on boot\n' +
    '  (node-pg-migrate checkOrder). Give the new migration a unique, LATER\n' +
    '  timestamp than every existing one.\n',
  );
  process.exit(1);
}

console.log(`✓ ${files.length} migrations OK — no duplicate or malformed timestamps.`);
