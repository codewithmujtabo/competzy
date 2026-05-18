import { Router, Request, Response } from "express";
import * as bcrypt from "bcrypt";
import { randomUUID, randomBytes } from "crypto";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { adminOnly } from "../middleware/admin.middleware";
import { requireRole } from "../middleware/require-role";
import { audit } from "../middleware/audit";
import { softDelete } from "../db/query-helpers";

// Country-representative routes (Komodo Wave 2 — Phase C). A representative
// (admin-created) manages one country's students for a competition's local
// round — bulk registration and, after an offline exam, a score import.
//
// Two path-scoped areas, each with its own guard. Mounted at /api:
//   /api/country-representatives/*  — admin: create + manage representatives
//   /api/rep/*                      — the representative's own portal API

const router = Router();

router.use("/country-representatives", authMiddleware, adminOnly);
router.use("/rep", authMiddleware, requireRole("country_representative"));

// The caller's representative assignment (competition + country).
async function repAssignment(userId: string) {
  const r = await pool.query(
    `SELECT cr.comp_id, cr.country, c.name AS comp_name
       FROM country_representatives cr
       LEFT JOIN competitions c ON c.id = cr.comp_id
      WHERE cr.id = $1`,
    [userId],
  );
  return r.rows[0] ?? null;
}

// The local round a representative manages — the competition's `local` round
// for their country.
async function localRound(compId: string, country: string) {
  const r = await pool.query(
    `SELECT id, round_name, fee, exam_mode, qualifying_score, exam_date::text AS exam_date
       FROM competition_rounds
      WHERE comp_id = $1 AND round_category = 'local' AND country = $2
      ORDER BY round_order ASC LIMIT 1`,
    [compId, country],
  );
  return r.rows[0] ?? null;
}

// ── Admin: GET /api/country-representatives ───────────────────────────────
router.get("/country-representatives", async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT u.id, u.full_name, u.email, cr.country, cr.comp_id,
              c.name AS comp_name, cr.created_at
         FROM country_representatives cr
         JOIN users u ON u.id = cr.id AND u.deleted_at IS NULL
         LEFT JOIN competitions c ON c.id = cr.comp_id
        ORDER BY cr.created_at DESC`,
    );
    res.json(
      r.rows.map((x) => ({
        id: x.id,
        fullName: x.full_name,
        email: x.email,
        country: x.country,
        compId: x.comp_id,
        compName: x.comp_name,
        createdAt: x.created_at,
      })),
    );
  } catch (err) {
    console.error("List country representatives error:", err);
    res.status(500).json({ message: "Failed to load representatives" });
  }
});

// ── Admin: POST /api/country-representatives ──────────────────────────────
router.post(
  "/country-representatives",
  audit({ action: "admin.country_rep.create", resourceType: "country_representative" }),
  async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      const { fullName, email, password, country, compId } = req.body ?? {};
      if (!fullName || !email || !password || !country || !compId) {
        res.status(400).json({
          message: "fullName, email, password, country and compId are required",
        });
        return;
      }
      await client.query("BEGIN");
      const hash = await bcrypt.hash(String(password), 10);
      const ins = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, consent_accepted_at)
         VALUES ($1, $2, $3, 'country_representative', NOW())
         RETURNING id`,
        [String(email).trim().toLowerCase(), hash, fullName],
      );
      const userId = ins.rows[0].id as string;
      await client.query(
        `INSERT INTO country_representatives (id, comp_id, country) VALUES ($1, $2, $3)`,
        [userId, compId, country],
      );
      await client.query("COMMIT");
      res.status(201).json({ id: userId, fullName, email, country, compId });
    } catch (err: any) {
      await client.query("ROLLBACK");
      if (err.code === "23505") {
        res.status(409).json({ message: "A user with that email already exists." });
        return;
      }
      console.error("Create country representative error:", err);
      res.status(500).json({ message: "Failed to create representative" });
    } finally {
      client.release();
    }
  },
);

// ── Admin: DELETE /api/country-representatives/:id ────────────────────────
router.delete(
  "/country-representatives/:id",
  audit({
    action: "admin.country_rep.delete",
    resourceType: "country_representative",
    resourceIdParam: "id",
  }),
  async (req: Request, res: Response) => {
    try {
      await softDelete("users", String(req.params.id));
      await pool.query("DELETE FROM country_representatives WHERE id = $1", [
        req.params.id,
      ]);
      res.json({ message: "Representative removed" });
    } catch (err) {
      console.error("Delete country representative error:", err);
      res.status(500).json({ message: "Failed to remove representative" });
    }
  },
);

// ── Rep: GET /api/rep/context ─────────────────────────────────────────────
// The representative's assignment, their local round, and the students they
// have registered for it.
router.get("/rep/context", async (req: Request, res: Response) => {
  try {
    const a = await repAssignment(req.userId!);
    if (!a) {
      res.status(404).json({ message: "No representative assignment found." });
      return;
    }
    const round = await localRound(a.comp_id, a.country);
    let students: any[] = [];
    if (round) {
      const s = await pool.query(
        `SELECT r.id AS registration_id, r.status, r.score, r.is_medalist,
                u.id AS user_id, u.full_name, u.email, st.grade
           FROM registrations r
           JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
           LEFT JOIN students st ON st.id = u.id
          WHERE r.round_id = $1 AND r.deleted_at IS NULL
          ORDER BY u.full_name ASC`,
        [round.id],
      );
      students = s.rows.map((x) => ({
        registrationId: x.registration_id,
        status: x.status,
        score: x.score,
        isMedalist: x.is_medalist,
        userId: x.user_id,
        fullName: x.full_name,
        email: x.email,
        grade: x.grade,
      }));
    }
    res.json({
      country: a.country,
      competition: { id: a.comp_id, name: a.comp_name },
      localRound: round
        ? {
            id: round.id,
            name: round.round_name,
            fee: Number(round.fee) || 0,
            examMode: round.exam_mode,
            qualifyingScore: round.qualifying_score,
            examDate: round.exam_date,
          }
        : null,
      students,
    });
  } catch (err) {
    console.error("Rep context error:", err);
    res.status(500).json({ message: "Failed to load your portal" });
  }
});

// ── Rep: POST /api/rep/students ───────────────────────────────────────────
// Bulk-register students for the representative's local round. Body:
// { students: [{ fullName, email, grade? }] }.
router.post("/rep/students", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const a = await repAssignment(req.userId!);
    if (!a) {
      res.status(404).json({ message: "No representative assignment found." });
      return;
    }
    const round = await localRound(a.comp_id, a.country);
    if (!round) {
      res.status(400).json({ message: "Your local round has not been set up yet." });
      return;
    }
    const rows = Array.isArray(req.body?.students) ? req.body.students : [];
    if (rows.length === 0) {
      res.status(400).json({ message: "No students provided." });
      return;
    }

    let created = 0;
    let registered = 0;
    let skipped = 0;
    await client.query("BEGIN");
    for (const s of rows) {
      const email = String(s?.email ?? "").trim().toLowerCase();
      const fullName = String(s?.fullName ?? s?.name ?? "").trim();
      const grade = s?.grade != null && String(s.grade).trim() ? String(s.grade).trim() : null;
      if (!email || !fullName) {
        skipped++;
        continue;
      }
      // Find or create the student account.
      let userId: string;
      const existing = await client.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id;
      } else {
        const hash = await bcrypt.hash(randomBytes(12).toString("base64"), 10);
        const ins = await client.query(
          `INSERT INTO users (email, password_hash, full_name, role, consent_accepted_at)
           VALUES ($1, $2, $3, 'student', NOW())
           RETURNING id`,
          [email, hash, fullName],
        );
        userId = ins.rows[0].id;
        await client.query(
          `INSERT INTO students (id, grade) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
          [userId, grade],
        );
        created++;
      }
      // One registration per student for the local round.
      const dup = await client.query(
        `SELECT 1 FROM registrations
          WHERE user_id = $1 AND comp_id = $2 AND round_id = $3 AND deleted_at IS NULL`,
        [userId, a.comp_id, round.id],
      );
      if (dup.rows.length > 0) {
        skipped++;
        continue;
      }
      const status = Number(round.fee) > 0 ? "pending_payment" : "pending_review";
      await client.query(
        `INSERT INTO registrations (id, user_id, comp_id, round_id, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), userId, a.comp_id, round.id, status],
      );
      registered++;
    }
    await client.query("COMMIT");
    res.json({ created, registered, skipped });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Rep bulk register error:", err);
    res.status(500).json({ message: "Failed to register students" });
  } finally {
    client.release();
  }
});

// ── Rep: POST /api/rep/import-scores ──────────────────────────────────────
// Import offline-exam scores. Body: { scores: [{ email, score }] }. Each score
// updates the student's local-round registration and re-decides the medal
// (score vs the round's qualifying_score) unless an operator locked it.
router.post("/rep/import-scores", async (req: Request, res: Response) => {
  try {
    const a = await repAssignment(req.userId!);
    if (!a) {
      res.status(404).json({ message: "No representative assignment found." });
      return;
    }
    const round = await localRound(a.comp_id, a.country);
    if (!round) {
      res.status(400).json({ message: "Your local round has not been set up yet." });
      return;
    }
    const rows = Array.isArray(req.body?.scores) ? req.body.scores : [];
    if (rows.length === 0) {
      res.status(400).json({ message: "No scores provided." });
      return;
    }
    const qualifying =
      round.qualifying_score != null ? Number(round.qualifying_score) : null;
    let updated = 0;
    const notFound: string[] = [];
    for (const row of rows) {
      const email = String(row?.email ?? "").trim().toLowerCase();
      const score = Number(row?.score);
      if (!email || !Number.isFinite(score)) continue;
      const isMedalist = qualifying != null ? score >= qualifying : null;
      const upd = await pool.query(
        `UPDATE registrations r
            SET score = $1,
                is_medalist = CASE WHEN r.medalist_locked THEN r.is_medalist ELSE $2 END,
                updated_at = now()
           FROM users u
          WHERE r.user_id = u.id AND lower(u.email) = $3
            AND r.round_id = $4 AND r.deleted_at IS NULL
        RETURNING r.id`,
        [score, isMedalist, email, round.id],
      );
      if (upd.rows.length > 0) updated++;
      else notFound.push(email);
    }
    res.json({ updated, notFound });
  } catch (err) {
    console.error("Rep import scores error:", err);
    res.status(500).json({ message: "Failed to import scores" });
  }
});

export default router;
