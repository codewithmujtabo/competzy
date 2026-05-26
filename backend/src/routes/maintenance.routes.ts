import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { adminOnly } from "../middleware/admin.middleware";
import { audit } from "../middleware/audit";

// ─────────────────────────────────────────────────────────────────────────
// Per-site maintenance toggle for the competzy.com landing page + the 12
// competition subdomains.
//
// Public surface (called server-to-server by competzy-web middleware):
//   GET  /api/maintenance/state?host=<host>   → { mode }
//
// Admin surface (cookie-authed admin):
//   GET    /api/admin/maintenance             → { entries, audit }
//   PATCH  /api/admin/maintenance/:host       → { ok, host, mode, updated_at }
//
// Contract: docs/arena-maintenance-spec.md in the competzy-web repo.
//
// Resolution rule: the synthetic row `host = '*'` is the global kill
// switch. If its mode is not 'off' it wins over every per-host row.
// Spec section 3 "State resolution logic".
// ─────────────────────────────────────────────────────────────────────────

const router: Router = Router();

const VALID_MODES = ["off", "read-only", "on"] as const;
type Mode = (typeof VALID_MODES)[number];

// Locked to the rows the seed migrations insert. Any other `host` value
// — including typos — is rejected by PATCH. The state endpoint also rejects
// unknown hosts (returns mode='off') so we never quietly serve junk values.
const KNOWN_HOSTS = new Set([
  "*",
  // Main — covers the public landing + arena portal itself
  "competzy.com",
  "arena.competzy.com",
  // Per-competition landing-page subdomains (12)
  "emc.competzy.com",
  "ispo.competzy.com",
  "osebi.competzy.com",
  "komodo.competzy.com",
  "genius.competzy.com",
  "owlypia.competzy.com",
  "mathchallenge.competzy.com",
  "stemolympiad.competzy.com",
  "nextgen.competzy.com",
  "youngmaster.competzy.com",
  "angkor.competzy.com",
  "igo.competzy.com",
]);

// ── In-memory cache for the public state lookup ─────────────────────────
// competzy-web polls this every 30s per subdomain. With 13 subdomains
// that's ~26 calls / minute steady-state — small, but cache anyway so
// admin PATCHes can stay snappy without rebuilding the global query on
// every poll. Invalidated by the admin PATCH on the same process.
//
// Note: at multi-replica time this cache becomes per-replica, which is
// fine because the TTL is short (30s) and competzy-web's middleware
// itself caches for 30s — worst case is a 60s lag, well within the
// admin's tolerance for a maintenance toggle.
const CACHE_TTL_MS = 30_000;
interface CacheEntry { mode: Mode; expiresAt: number }
const stateCache = new Map<string, CacheEntry>();

function cacheGet(host: string): Mode | null {
  const hit = stateCache.get(host);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    stateCache.delete(host);
    return null;
  }
  return hit.mode;
}

function cacheSet(host: string, mode: Mode): void {
  stateCache.set(host, { mode, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Invalidate the cache after any write. Clears every key because the
 * global '*' row affects every host's resolved mode.
 */
function cacheInvalidate(): void {
  stateCache.clear();
}

async function resolveMode(host: string): Promise<Mode> {
  const cached = cacheGet(host);
  if (cached) return cached;

  // One round-trip — fetch both the global row and the per-host row.
  const r = await pool.query<{ host: string; mode: string }>(
    `SELECT host, mode FROM site_maintenance WHERE host IN ('*', $1)`,
    [host],
  );

  let globalMode: Mode = "off";
  let hostMode: Mode = "off";
  for (const row of r.rows) {
    if (!isValidMode(row.mode)) continue;
    if (row.host === "*") globalMode = row.mode;
    else if (row.host === host) hostMode = row.mode;
  }
  // Global override: any non-off global mode beats per-host mode.
  const mode: Mode = globalMode !== "off" ? globalMode : hostMode;
  cacheSet(host, mode);
  return mode;
}

function isValidMode(value: unknown): value is Mode {
  return typeof value === "string" && (VALID_MODES as readonly string[]).includes(value);
}

// ── GET /api/maintenance/state ──────────────────────────────────────────
// PUBLIC — called server-to-server by competzy-web. No auth. Always 200,
// always returns `{ mode }`. Unknown / missing host falls back to 'off'
// (fail-open — toggle failure must never take public sites down).
router.get("/maintenance/state", async (req: Request, res: Response) => {
  // Helpful default for browser tabs; competzy-web's middleware always
  // sends the header explicitly.
  res.set("Cache-Control", "public, max-age=30");

  const rawHost = (req.query.host as string | undefined)?.trim().toLowerCase();
  if (!rawHost || !KNOWN_HOSTS.has(rawHost) || rawHost === "*") {
    res.json({ mode: "off" });
    return;
  }

  try {
    const mode = await resolveMode(rawHost);
    res.json({ mode });
  } catch (err) {
    // Fail open — never propagate a DB error to the public middleware,
    // which would risk a maintenance-page cascade across every subdomain.
    console.error("[maintenance] state lookup failed:", err);
    res.json({ mode: "off" });
  }
});

// ── Admin sub-tree ─────────────────────────────────────────────────────
// Path-scoped — only `/admin/maintenance*` requires admin auth (the public
// /maintenance/state route above stays open).
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req, res, (err?: unknown) => {
    if (err) return next(err);
    adminOnly(req, res, next);
  });
};

// ── GET /api/admin/maintenance ─────────────────────────────────────────
// Returns every site_maintenance row + the last 20 audit entries for
// the maintenance action (oldest → newest). The page renders both in
// one round-trip.
router.get("/admin/maintenance", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [entries, auditEntries] = await Promise.all([
      // updated_by is the user id; LEFT JOIN to render the friendly email
      // in the UI without a per-row fetch. `updated_by = 'system'` (the
      // seed value) doesn't match a uuid so the email comes back null —
      // the UI shows "system" in that case.
      pool.query(
        `SELECT sm.host, sm.mode, sm.updated_by, sm.updated_at,
                u.email AS updated_by_email, u.full_name AS updated_by_name
           FROM site_maintenance sm
           LEFT JOIN users u ON u.id::text = sm.updated_by
          ORDER BY sm.host = '*' DESC, sm.host ASC`,
      ),
      pool.query(
        `SELECT a.id, a.action, a.resource_id, a.payload,
                a.created_at,
                u.full_name AS actor_name, u.email AS actor_email
           FROM audit_log a
           LEFT JOIN users u ON u.id = a.user_id
          WHERE a.action IN ('admin.maintenance.update', 'admin.arena_settings.update')
          ORDER BY a.created_at DESC
          LIMIT 20`,
      ),
    ]);
    res.json({
      entries: entries.rows,
      audit: auditEntries.rows,
    });
  } catch (err) {
    console.error("Maintenance list error:", err);
    res.status(500).json({ message: "Failed to load maintenance state" });
  }
});

// ── PATCH /api/admin/maintenance/:host ─────────────────────────────────
// Toggle a single host (or the '*' global kill switch). Audited.
//
// `:host` is decoded by Express; clients send the host verbatim (dots
// allowed in the URL segment) — e.g.
//   PATCH /api/admin/maintenance/emc.competzy.com
const PatchBody = z.object({
  mode: z.enum(VALID_MODES),
});

router.patch(
  "/admin/maintenance/:host",
  requireAdmin,
  audit({
    action: "admin.maintenance.update",
    resourceType: "site_maintenance",
    resourceIdParam: "host",
  }),
  async (req: Request, res: Response) => {
    const rawParam = (req.params.host as string | string[] | undefined) ?? "";
    const host = decodeURIComponent(Array.isArray(rawParam) ? rawParam[0] : rawParam).trim().toLowerCase();

    if (!host || !KNOWN_HOSTS.has(host)) {
      res.status(400).json({ message: "Unknown host" });
      return;
    }

    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input", issues: parsed.error.flatten() });
      return;
    }

    try {
      // The seed migration inserts every known host, but ON CONFLICT also
      // makes this resilient to a manual schema edit. `updated_by` stores
      // the admin's user id; the GET endpoint LEFT JOINs to expose the
      // friendly email to the UI.
      const updatedBy = req.userId ?? "unknown";
      const r = await pool.query(
        `INSERT INTO site_maintenance (host, mode, updated_by, updated_at)
           VALUES ($1, $2, $3, NOW())
         ON CONFLICT (host) DO UPDATE
            SET mode = EXCLUDED.mode,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW()
         RETURNING host, mode, updated_by, updated_at`,
        [host, parsed.data.mode, updatedBy],
      );
      cacheInvalidate();
      res.json({ ok: true, ...r.rows[0] });
    } catch (err) {
      console.error("Maintenance update error:", err);
      res.status(500).json({ message: "Failed to update maintenance state" });
    }
  },
);

export default router;
