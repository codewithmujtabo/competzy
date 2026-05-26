/**
 * Maintenance state — fetched from the arena backend per host, cached 30s.
 * Mirrors competzy-web/lib/maintenance.ts so both repos enforce the same
 * `/api/maintenance/state` contract.
 *
 * Used by middleware.ts to decide whether to gate a public visitor with
 * the /maintenance takeover page.
 *
 * SAFETY: every failure path returns mode='off'. If the backend is
 * unreachable, misconfigured, or returns garbage, arena stays up as if
 * nothing happened. The toggle CANNOT lock the portal out through this
 * path.
 *
 * Thundering-herd guard: an in-flight Promise per host is coalesced — if
 * 1000 concurrent middleware invocations hit the same host within the
 * ~200ms fetch window, only ONE backend request goes out. All 1000 awaits
 * resolve from the same Promise.
 */
export type MaintenanceMode = 'off' | 'read-only' | 'on';
export interface MaintenanceState {
  mode: MaintenanceMode;
}

const TTL_MS = 30_000;
const TIMEOUT_MS = 2_000;
const cache = new Map<string, { state: MaintenanceState; expires: number }>();
const inflight = new Map<string, Promise<MaintenanceState>>();

function safeMode(v: unknown): MaintenanceMode {
  return v === 'on' || v === 'read-only' ? v : 'off';
}

function endpoint(): string {
  // Prefer the explicit override (set on Coolify in prod for direct edge
  // → internal-docker hop without TLS), else the colocated BACKEND_URL
  // already used by next.config.mjs for /api rewrites, else dev default.
  const base =
    process.env.MAINTENANCE_API_URL ??
    process.env.BACKEND_URL ??
    'http://localhost:3010';
  // BACKEND_URL is a bare origin (no /api). MAINTENANCE_API_URL is allowed
  // to be the full path; detect by trailing `/state`.
  if (base.endsWith('/state')) return base;
  return `${base.replace(/\/$/, '')}/api/maintenance/state`;
}

async function fetchAndCache(host: string): Promise<MaintenanceState> {
  try {
    const url = `${endpoint()}?host=${encodeURIComponent(host)}`;
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { mode?: unknown };
    const state: MaintenanceState = { mode: safeMode(data?.mode) };
    cache.set(host, { state, expires: Date.now() + TTL_MS });
    return state;
  } catch {
    // Fail-open. Cache the "off" too so we don't hammer the backend while
    // it's down.
    const state: MaintenanceState = { mode: 'off' };
    cache.set(host, { state, expires: Date.now() + TTL_MS });
    return state;
  }
}

export async function getMaintenance(host: string): Promise<MaintenanceState> {
  if (!host) return { mode: 'off' };

  const cached = cache.get(host);
  if (cached && cached.expires > Date.now()) return cached.state;

  // Coalesce concurrent misses. If another middleware invocation already
  // kicked off a fetch for this host, ride that Promise instead of
  // launching our own.
  const existing = inflight.get(host);
  if (existing) return existing;

  const promise = fetchAndCache(host).finally(() => {
    inflight.delete(host);
  });
  inflight.set(host, promise);
  return promise;
}
