import { Router, Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";

import { pool } from "../config/database";
import { env } from "../config/env";
import { authMiddleware } from "../middleware/auth";
import { adminOrManager } from "../middleware/admin.middleware";
import { audit } from "../middleware/audit";

// ─────────────────────────────────────────────────────────────────────────
// Waitlist receiver + admin tooling.
//
// Public surface (called server-to-server by competzy-web subdomains):
//   POST /api/waitlist                         — receive a signup
//
// Admin surface (cookie-authed admin only):
//   GET   /api/admin/waitlist                  — list with filters
//   POST  /api/admin/waitlist/draw             — voucher draw on filtered set
//
// Contract: docs/arena-waitlist-spec.md in the competzy-web repo.
// ─────────────────────────────────────────────────────────────────────────

const router: Router = Router();

// ── Valid competition slugs accepted from the landing page ──────────────
// Locked to the 12 active subdomains per the spec. Any other slug returns
// 400 — easier to catch typos than silently store garbage.
const COMP_SLUGS = [
  "emc", "ispo", "osebi", "komodo", "genius", "owlypia",
  "mathchallenge", "stemolympiad", "nextgen", "youngmaster",
  "angkor", "igo",
] as const;

// Closed-enum marketing-attribution channels. Spec section 2.
// Optional at the API level (legacy clients send without it); EMC's
// form makes it required UI-side.
const HEARD_FROM_CHANNELS = [
  "instagram", "tiktok", "sekolah_guru", "teman", "orang_tua",
  "alumni_emc", "google", "wa_telegram", "facebook", "youtube", "lainnya",
] as const;

const WaitlistPayload = z.object({
  comp: z.enum(COMP_SLUGS),
  lang: z.enum(["id", "en"]).optional(),
  nama: z.string().trim().min(2).max(200),
  kelas: z.string().trim().min(1).max(20),
  kota: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  // WA: any sender-normalised Indonesian mobile ("+62…" or "08…"), 8–15 digits.
  whatsapp: z.string().trim().regex(/^(\+?\d{8,15})$/, "Invalid WhatsApp number"),
  // Marketing attribution. Closed enum, optional at API level — legacy
  // clients (pre-spec-v2) won't send it; new EMC form does.
  heardFrom: z.enum(HEARD_FROM_CHANNELS).optional(),
  submittedAt: z.string().datetime().optional(),
  source: z.string().trim().max(120).optional(),
  userAgent: z.string().max(500).nullable().optional(),
  ipHint: z.string().max(120).nullable().optional(),
});

// ── POST /api/waitlist ───────────────────────────────────────────────────
// Public-ish endpoint. Optional Bearer-token auth: when `ARENA_WAITLIST_TOKEN`
// is set in env, the receiver REQUIRES a matching `Authorization: Bearer`
// header. When empty (dev / initial rollout), any caller is accepted.
//
// Returns `{ ok: true }` for both inserts AND ON CONFLICT duplicates so the
// sender's success state is preserved on re-submissions (spec section 4a).
router.post("/waitlist", async (req: Request, res: Response) => {
  // 1. Optional shared-secret check.
  if (env.ARENA_WAITLIST_TOKEN) {
    const header = req.headers.authorization;
    const expected = `Bearer ${env.ARENA_WAITLIST_TOKEN}`;
    if (header !== expected) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
  }

  // 2. zod parse — return 400 with issues so the sender can log them.
  const parsed = WaitlistPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_input", issues: parsed.error.flatten() });
    return;
  }
  const p = parsed.data;

  // 3. Fall back to "now" + a generic source if the sender omitted them.
  const submittedAt = p.submittedAt ?? new Date().toISOString();
  const source = p.source ?? "unknown";

  try {
    await pool.query(
      `INSERT INTO waitlist_entry
         (comp, lang, nama, kelas, kota, email, whatsapp, heard_from,
          submitted_at, source, user_agent, ip_hint)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (comp, email) DO NOTHING`,
      [
        p.comp,
        p.lang ?? null,
        p.nama,
        p.kelas,
        p.kota,
        p.email,
        p.whatsapp,
        p.heardFrom ?? null,
        submittedAt,
        source,
        p.userAgent ?? null,
        p.ipHint ?? null,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Waitlist insert error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

// ── Admin sub-tree ───────────────────────────────────────────────────────
// Path-scoped: only `/admin/waitlist*` requires auth+admin (the public
// /waitlist route above stays open).
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  authMiddleware(req, res, (err?: unknown) => {
    if (err) return next(err);
    adminOrManager(req, res, next);
  });
};

// ── GET /api/admin/waitlist ─────────────────────────────────────────────
// Filtered list. Query params:
//   comp        — slug filter (omit for all)
//   voucher     — "won" | "open" (omit for all)
//   since       — ISO date string; only entries created on/after this
//   search      — free-text across nama, email, kota
//   page, limit — pagination (default 1, 50; capped to 500)
router.get("/admin/waitlist", requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    const comp = (req.query.comp as string | undefined)?.trim();
    if (comp && comp !== "all") {
      where.push(`comp = $${i++}`);
      params.push(comp);
    }

    const voucher = (req.query.voucher as string | undefined)?.trim();
    if (voucher === "won") where.push(`is_voucher_winner = true`);
    else if (voucher === "open") where.push(`is_voucher_winner = false`);

    const since = (req.query.since as string | undefined)?.trim();
    if (since) {
      where.push(`created_at >= $${i++}`);
      params.push(since);
    }

    const heardFrom = (req.query.heardFrom as string | undefined)?.trim();
    if (heardFrom && heardFrom !== "all") {
      where.push(`heard_from = $${i++}`);
      params.push(heardFrom);
    }

    const search = (req.query.search as string | undefined)?.trim();
    if (search) {
      where.push(`(nama ILIKE $${i} OR email ILIKE $${i} OR kota ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [data, count] = await Promise.all([
      pool.query(
        `SELECT id, comp, lang, nama, kelas, kota, email, whatsapp, heard_from,
                submitted_at, source, user_agent, ip_hint,
                is_voucher_winner, voucher_code, voucher_drawn_at, created_at
           FROM waitlist_entry
           ${whereSql}
           ORDER BY created_at DESC
           LIMIT $${i} OFFSET $${i + 1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM waitlist_entry ${whereSql}`, params),
    ]);

    const total = parseInt(count.rows[0].count, 10);
    res.json({
      entries: data.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Waitlist list error:", err);
    res.status(500).json({ message: "Failed to load waitlist" });
  }
});

// ── POST /api/admin/waitlist/draw ──────────────────────────────────────
// Voucher draw. Picks N random entries from the CURRENT FILTER, marks them
// as winners, generates a `voucher_code`, sets `voucher_drawn_at`.
// Idempotent: only picks rows where `is_voucher_winner = false` so re-running
// the same draw doesn't double-count earlier winners.
//
// Body: { count: number, comp?: string, since?: string, search?: string }
//   - `count`              required, 1–500
//   - `comp/since/search`  same shape as the list endpoint's filters
//
// Returns { drawn: number, entries: [{id, comp, email, voucher_code}…] }
router.post(
  "/admin/waitlist/draw",
  requireAdmin,
  audit({ action: "admin.waitlist.draw", resourceType: "waitlist" }),
  async (req: Request, res: Response) => {
    try {
      const Body = z.object({
        count: z.number().int().min(1).max(500),
        comp: z.string().optional(),
        since: z.string().datetime().optional(),
        search: z.string().optional(),
      });
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid input", issues: parsed.error.flatten() });
        return;
      }
      const { count, comp, since, search } = parsed.data;

      // Pick N random non-winners matching the filter, atomically — pure
      // SQL (single UPDATE + RETURNING) so concurrent draws don't double-
      // assign the same entry.
      const where: string[] = ["is_voucher_winner = false"];
      const params: unknown[] = [];
      let i = 1;
      if (comp && comp !== "all") {
        where.push(`comp = $${i++}`);
        params.push(comp);
      }
      if (since) {
        where.push(`created_at >= $${i++}`);
        params.push(since);
      }
      if (search) {
        where.push(`(nama ILIKE $${i} OR email ILIKE $${i} OR kota ILIKE $${i})`);
        params.push(`%${search}%`);
        i++;
      }
      const whereSql = `WHERE ${where.join(" AND ")}`;

      // Generate one short voucher code per winner. Format: WL-<COMP>-XXXXXXXX
      // (8-char base32, no ambiguous chars). Per-row code so each winner can
      // redeem independently.
      const generateCode = (compSlug: string): string => {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/1/I/O
        const bytes = randomBytes(8);
        let suffix = "";
        for (let j = 0; j < 8; j++) suffix += alphabet[bytes[j] % alphabet.length];
        return `WL-${compSlug.toUpperCase()}-${suffix}`;
      };

      const update = await pool.query(
        `WITH picked AS (
           SELECT id, comp FROM waitlist_entry
           ${whereSql}
           ORDER BY random()
           LIMIT $${i}
         )
         UPDATE waitlist_entry w
            SET is_voucher_winner = true,
                voucher_drawn_at = NOW(),
                voucher_code = '__PENDING__'   -- placeholder, set per-row below
          FROM picked
          WHERE w.id = picked.id
          RETURNING w.id, w.comp, w.email`,
        [...params, count]
      );

      // Stamp the real codes in a second pass — one UPDATE per winner so
      // each gets a fresh random code. Few rows, no perf concern.
      const winners: Array<{ id: number; comp: string; email: string; voucher_code: string }> = [];
      for (const row of update.rows) {
        const code = generateCode(row.comp);
        await pool.query(
          `UPDATE waitlist_entry SET voucher_code = $1 WHERE id = $2`,
          [code, row.id]
        );
        winners.push({ id: row.id, comp: row.comp, email: row.email, voucher_code: code });
      }

      res.json({ drawn: winners.length, entries: winners });
    } catch (err) {
      console.error("Waitlist draw error:", err);
      res.status(500).json({ message: "Failed to run voucher draw" });
    }
  }
);

// ── GET /api/admin/waitlist/channels ────────────────────────────────────
// Channel attribution panel — counts per `heard_from` channel within the
// current filter (same shape as the list endpoint's params, minus
// `heardFrom`). Excludes NULL rows so legacy entries don't skew the chart
// (per spec section 4c).
router.get("/admin/waitlist/channels", requireAdmin, async (req: Request, res: Response) => {
  try {
    const where: string[] = ["heard_from IS NOT NULL"];
    const params: unknown[] = [];
    let i = 1;

    const comp = (req.query.comp as string | undefined)?.trim();
    if (comp && comp !== "all") {
      where.push(`comp = $${i++}`);
      params.push(comp);
    }
    const voucher = (req.query.voucher as string | undefined)?.trim();
    if (voucher === "won") where.push(`is_voucher_winner = true`);
    else if (voucher === "open") where.push(`is_voucher_winner = false`);
    const since = (req.query.since as string | undefined)?.trim();
    if (since) {
      where.push(`created_at >= $${i++}`);
      params.push(since);
    }
    const search = (req.query.search as string | undefined)?.trim();
    if (search) {
      where.push(`(nama ILIKE $${i} OR email ILIKE $${i} OR kota ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const r = await pool.query(
      `SELECT heard_from AS channel, COUNT(*)::int AS count
         FROM waitlist_entry
         ${whereSql}
        GROUP BY heard_from
        ORDER BY count DESC`,
      params
    );
    res.json({ channels: r.rows });
  } catch (err) {
    console.error("Waitlist channels error:", err);
    res.status(500).json({ message: "Failed to load channel stats" });
  }
});

// ── DELETE /api/admin/waitlist/:id ──────────────────────────────────────
// Hard delete (no soft-delete column on this table — entries are
// considered ephemeral marketing data, not core records). Used by the
// admin to clean up test rows + spam.
router.delete(
  "/admin/waitlist/:id",
  requireAdmin,
  audit({ action: "admin.waitlist.delete", resourceType: "waitlist", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ message: "Invalid id" });
        return;
      }
      const r = await pool.query("DELETE FROM waitlist_entry WHERE id = $1", [id]);
      if (r.rowCount === 0) {
        res.status(404).json({ message: "Entry not found" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("Waitlist delete error:", err);
      res.status(500).json({ message: "Failed to delete entry" });
    }
  }
);

export default router;
