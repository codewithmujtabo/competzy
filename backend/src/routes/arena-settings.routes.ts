import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";

import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { adminOnly } from "../middleware/admin.middleware";
import { audit } from "../middleware/audit";

// ─────────────────────────────────────────────────────────────────────────
// Arena feature-flag toggles — owned by the admin via /admin/maintenance.
//
// Distinct from site_maintenance (the public landing-page gate). This
// table holds arena.competzy.com's own admin-controllable feature
// flags: today just `registration_enabled`, designed to extend without
// migration (every new flag = a new row).
//
// Public surface (auth-free — the register page on web pre-checks UI):
//   GET  /api/arena-settings/public   → { registration_enabled }
//
// Admin surface (cookie-authed admin):
//   GET    /api/admin/arena-settings        → list all rows
//   PATCH  /api/admin/arena-settings/:key   → audit-logged write
//
// Hot-path consumers (e.g. the signup route) use {@link isFlagEnabled}
// rather than hitting the DB themselves.
// ─────────────────────────────────────────────────────────────────────────

const router: Router = Router();

// ── Whitelist of known flags. New flag = add the key here + the seed
//    migration. PATCH rejects unknown keys (so admins can't typo a
//    setting into existence). ──────────────────────────────────────────
const KNOWN_FLAGS = new Set<string>(["registration_enabled"]);

// ── In-memory cache for the hot-path lookup. The PATCH endpoint
//    invalidates after every write, so admins see their toggle take
//    effect immediately. TTL matches the maintenance-state cache
//    pattern (30s) — at multi-replica time this becomes per-replica,
//    same trade-off as discussed for site_maintenance. ─────────────────
const CACHE_TTL_MS = 30_000;
interface CacheEntry { value: unknown; expiresAt: number }
const flagCache = new Map<string, CacheEntry>();

function cacheInvalidate(): void {
  flagCache.clear();
}

/**
 * Read a single flag from cache → DB. Returns `null` when the flag
 * doesn't exist (unknown key OR row was deleted). Hot-path callers
 * (signup route) read this; admins go through the GET/PATCH endpoints.
 */
export async function readFlag(key: string): Promise<unknown> {
  const hit = flagCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const r = await pool.query<{ value: unknown }>(
    "SELECT value FROM arena_settings WHERE key = $1",
    [key],
  );
  const value = r.rows[0]?.value ?? null;
  flagCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/**
 * Convenience wrapper for boolean flags. Defaults to `true` when the row
 * is missing or non-boolean — fail-OPEN. The semantic is "admin must
 * explicitly DISABLE", never "admin must explicitly enable". A
 * misconfigured DB shouldn't lock the whole site out.
 */
export async function isFlagEnabled(key: string): Promise<boolean> {
  const value = await readFlag(key);
  if (typeof value === "boolean") return value;
  return true;
}

// ── GET /api/arena-settings/public ──────────────────────────────────────
// PUBLIC — exposes only the subset of flags that the register page +
// other unauthenticated client UIs need to know about. Never expose
// admin-only operational flags here.
router.get("/arena-settings/public", async (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=30");
  try {
    const registrationEnabled = await isFlagEnabled("registration_enabled");
    res.json({ registration_enabled: registrationEnabled });
  } catch (err) {
    // Fail-open — never let the public endpoint take the register page
    // down because the DB hiccupped.
    console.error("[arena-settings] public lookup failed:", err);
    res.json({ registration_enabled: true });
  }
});

// ── Admin sub-tree ─────────────────────────────────────────────────────
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req, res, (err?: unknown) => {
    if (err) return next(err);
    adminOnly(req, res, next);
  });
};

// ── GET /api/admin/arena-settings ──────────────────────────────────────
// Returns every row + the joined updated_by email so the UI can render
// "Last changed N min ago by <email>".
router.get("/admin/arena-settings", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT s.key, s.value, s.description, s.updated_by, s.updated_at,
              u.email AS updated_by_email
         FROM arena_settings s
         LEFT JOIN users u ON u.id::text = s.updated_by
        ORDER BY s.key ASC`,
    );
    res.json({ settings: r.rows });
  } catch (err) {
    console.error("Arena settings list error:", err);
    res.status(500).json({ message: "Failed to load arena settings" });
  }
});

// ── PATCH /api/admin/arena-settings/:key ───────────────────────────────
// Update a single flag. Audited. Cache invalidated so the new value is
// in effect before the response returns.
const PatchBody = z.object({
  value: z.unknown(),
});

router.patch(
  "/admin/arena-settings/:key",
  requireAdmin,
  audit({
    action: "admin.arena_settings.update",
    resourceType: "arena_settings",
    resourceIdParam: "key",
  }),
  async (req: Request, res: Response) => {
    const rawKey = (req.params.key as string | string[] | undefined) ?? "";
    const key = (Array.isArray(rawKey) ? rawKey[0] : rawKey).trim();

    if (!key || !KNOWN_FLAGS.has(key)) {
      res.status(400).json({ message: "Unknown setting key" });
      return;
    }

    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input", issues: parsed.error.flatten() });
      return;
    }

    // Per-key value validation. Today only one flag, but the switch
    // makes it obvious where to add per-key shape rules later.
    let coerced: unknown;
    switch (key) {
      case "registration_enabled":
        if (typeof parsed.data.value !== "boolean") {
          res.status(400).json({ message: "registration_enabled must be a boolean" });
          return;
        }
        coerced = parsed.data.value;
        break;
      default:
        res.status(400).json({ message: "Unsupported setting" });
        return;
    }

    try {
      const updatedBy = req.userId ?? "unknown";
      const r = await pool.query(
        `INSERT INTO arena_settings (key, value, updated_by, updated_at)
           VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW()
         RETURNING key, value, description, updated_by, updated_at`,
        [key, JSON.stringify(coerced), updatedBy],
      );
      cacheInvalidate();
      res.json({ ok: true, ...r.rows[0] });
    } catch (err) {
      console.error("Arena settings update error:", err);
      res.status(500).json({ message: "Failed to update arena setting" });
    }
  },
);

export default router;
