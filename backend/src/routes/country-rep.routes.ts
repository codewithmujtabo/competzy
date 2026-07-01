import { Router, Request, Response } from "express";
import * as bcrypt from "bcrypt";
import { randomUUID, randomBytes } from "crypto";
import PDFDocument from "pdfkit";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { adminOrManager } from "../middleware/admin.middleware";
import { requireRole } from "../middleware/require-role";
import { audit } from "../middleware/audit";
import { softDelete } from "../db/query-helpers";
import { createSnapToken, getTransactionStatus } from "../services/midtrans.service";

// Country-representative routes (Komodo Wave 2 — Phase C). A representative
// (admin-created) manages one country's students for a competition's local
// round — bulk registration and, after an offline exam, a score import.
//
// Two path-scoped areas, each with its own guard. Mounted at /api:
//   /api/country-representatives/*  — admin: create + manage representatives
//   /api/rep/*                      — the representative's own portal API

const router: Router = Router();

router.use("/country-representatives", authMiddleware, adminOrManager);
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
// for their country. May not exist (Komodo doesn't always have a local round
// for every country); callers must tolerate null.
async function localRound(compId: string, country: string) {
  const r = await pool.query(
    `SELECT id, round_name, fee, exam_mode, qualifying_score, exam_date::text AS exam_date
       FROM competition_rounds
      WHERE comp_id = $1 AND round_category = 'local' AND country = $2
        AND is_active = true
      ORDER BY round_order ASC LIMIT 1`,
    [compId, country],
  );
  return r.rows[0] ?? null;
}

// Every round a representative may operate on: every ACTIVE online /
// fast-track / global round in the competition plus the rep's own country's
// local round (also only when active). A round the operator hasn't turned on
// is invisible to students — so it's invisible to the rep too. A `local`
// round bound to a different country stays hidden regardless: only that
// country's rep manages it.
async function repRounds(compId: string, country: string) {
  const r = await pool.query(
    `SELECT id, round_name, round_category, country, is_active,
            fee, exam_mode, qualifying_score, exam_date::text AS exam_date,
            round_order
       FROM competition_rounds
      WHERE comp_id = $1
        AND is_active = true
        AND (round_category <> 'local' OR country = $2)
      ORDER BY round_order ASC`,
    [compId, country],
  );
  return r.rows;
}

// Resolve a round the rep wants to operate on. If `roundId` is provided, it
// must be in the rep's accessible set. Otherwise fall back to the local round.
// Returns the round row or null when nothing is accessible.
async function resolveRepRound(
  compId: string,
  country: string,
  roundId: string | null,
) {
  if (roundId) {
    const r = await pool.query(
      `SELECT id, round_name, round_category, country, is_active,
              fee, exam_mode, qualifying_score, exam_date::text AS exam_date
         FROM competition_rounds
        WHERE id = $1 AND comp_id = $2
          AND is_active = true
          AND (round_category <> 'local' OR country = $3)`,
      [roundId, compId, country],
    );
    return r.rows[0] ?? null;
  }
  return localRound(compId, country);
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
// The representative's assignment, the local round (when present), every
// accessible round, and the student roster for the selected round.
//
// Query: ?roundId=<roundId> — selects the round to load students for. When
// omitted, defaults to the local round (legacy behaviour); when there is no
// local round either, students is an empty array and the UI prompts the rep
// to pick a round from the list.
router.get("/rep/context", async (req: Request, res: Response) => {
  try {
    const a = await repAssignment(req.userId!);
    if (!a) {
      res.status(404).json({ message: "No representative assignment found." });
      return;
    }
    const rounds = await repRounds(a.comp_id, a.country);
    const local = rounds.find((r) => r.round_category === "local") ?? null;
    const requestedRoundId =
      typeof req.query.roundId === "string" && req.query.roundId.trim()
        ? req.query.roundId.trim()
        : null;
    // The selected round must be in the rep's accessible set — bouncing an
    // unknown id back to local keeps a stale URL from leaking another country's
    // local-round data.
    const selected =
      (requestedRoundId && rounds.find((r) => r.id === requestedRoundId)) ||
      local ||
      null;

    let students: any[] = [];
    if (selected) {
      const s = await pool.query(
        `SELECT r.id AS registration_id, r.status, r.score, r.is_medalist,
                u.id AS user_id, u.full_name, u.email, st.grade
           FROM registrations r
           JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
           LEFT JOIN students st ON st.id = u.id
          WHERE r.round_id = $1 AND r.deleted_at IS NULL
          ORDER BY u.full_name ASC`,
        [selected.id],
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

    const toRoundView = (r: any) => ({
      id: r.id,
      name: r.round_name,
      category: r.round_category,
      country: r.country ?? null,
      isActive: r.is_active !== false,
      fee: Number(r.fee) || 0,
      examMode: r.exam_mode,
      qualifyingScore: r.qualifying_score,
      examDate: r.exam_date,
    });

    res.json({
      country: a.country,
      competition: { id: a.comp_id, name: a.comp_name },
      rounds: rounds.map(toRoundView),
      // localRound + selectedRound expose the same shape — old clients keep
      // working on `localRound`, new clients read `selectedRound` to honour
      // the ?roundId query param.
      localRound: local ? toRoundView(local) : null,
      selectedRound: selected ? toRoundView(selected) : null,
      students,
    });
  } catch (err) {
    console.error("Rep context error:", err);
    res.status(500).json({ message: "Failed to load your portal" });
  }
});

// ── Rep: POST /api/rep/students ───────────────────────────────────────────
// Bulk-register students for one round of the rep's competition. Body:
// { roundId?: string, students: [{ fullName, email, grade? }] }.
// roundId is optional — when omitted, falls back to the rep's local round.
// When neither is available, returns 400 with a "pick a round" prompt rather
// than failing silently. Picking a round bound to a different country is
// rejected as 400 (the round isn't in the rep's accessible set).
router.post("/rep/students", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const a = await repAssignment(req.userId!);
    if (!a) {
      res.status(404).json({ message: "No representative assignment found." });
      return;
    }
    const requestedRoundId =
      typeof req.body?.roundId === "string" && req.body.roundId.trim()
        ? req.body.roundId.trim()
        : null;
    const round = await resolveRepRound(a.comp_id, a.country, requestedRoundId);
    if (!round) {
      res.status(400).json({
        message: requestedRoundId
          ? "That round is not available to you."
          : "Please pick a round to register these students for.",
      });
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
    const requestedRoundId =
      typeof req.body?.roundId === "string" && req.body.roundId.trim()
        ? req.body.roundId.trim()
        : null;
    const round = await resolveRepRound(a.comp_id, a.country, requestedRoundId);
    if (!round) {
      res.status(400).json({
        message: requestedRoundId
          ? "That round is not available to you."
          : "Please pick a round to import scores for.",
      });
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

// ── Rep: POST /api/rep/pay-batch ──────────────────────────────────────────
// One Midtrans transaction for every unpaid student of the local round.
router.post("/rep/pay-batch", async (req: Request, res: Response) => {
  try {
    const a = await repAssignment(req.userId!);
    if (!a) {
      res.status(404).json({ message: "No representative assignment found." });
      return;
    }
    const requestedRoundId =
      typeof req.body?.roundId === "string" && req.body.roundId.trim()
        ? req.body.roundId.trim()
        : null;
    const round = await resolveRepRound(a.comp_id, a.country, requestedRoundId);
    if (!round) {
      res.status(400).json({
        message: requestedRoundId
          ? "That round is not available to you."
          : "Please pick a round to pay for.",
      });
      return;
    }
    const fee = Number(round.fee) || 0;
    if (fee <= 0) {
      res.status(400).json({ message: "This round is free. No payment is needed." });
      return;
    }
    const regs = await pool.query(
      `SELECT id FROM registrations
        WHERE round_id = $1 AND status = 'pending_payment' AND deleted_at IS NULL`,
      [round.id],
    );
    if (regs.rows.length === 0) {
      res.status(400).json({ message: "No unpaid students to pay for." });
      return;
    }
    const regIds: string[] = regs.rows.map((x) => x.id);
    const total = fee * regIds.length;
    const me = await pool.query("SELECT full_name, email FROM users WHERE id = $1", [
      req.userId,
    ]);
    const orderId = `REPBATCH-${randomUUID()}`.slice(0, 50);
    const snap = await createSnapToken({
      orderId,
      amount: total,
      customerName: me.rows[0]?.full_name || "Country Representative",
      customerEmail: me.rows[0]?.email || "",
      competitionName: `${round.round_name} — ${regIds.length} students`,
    });
    const ins = await pool.query(
      `INSERT INTO rep_payment_batches
         (comp_id, round_id, created_by, registration_ids, total_amount, order_id, snap_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [a.comp_id, round.id, req.userId, regIds, total, orderId, snap.snapToken],
    );
    res.status(201).json({
      batchId: ins.rows[0].id,
      snapToken: snap.snapToken,
      redirectUrl: snap.redirectUrl,
      totalAmount: total,
      count: regIds.length,
    });
  } catch (err) {
    console.error("Rep pay-batch error:", err);
    res.status(500).json({ message: "Failed to start the batch payment" });
  }
});

// ── Rep: GET /api/rep/pay-batch/:id/verify ────────────────────────────────
// Polls Midtrans for the batch and, once settled, marks every covered
// registration paid (the payment webhook does the same, server-to-server).
router.get("/rep/pay-batch/:id/verify", async (req: Request, res: Response) => {
  try {
    const b = await pool.query(
      `SELECT id, order_id, registration_ids, status
         FROM rep_payment_batches WHERE id = $1 AND created_by = $2`,
      [req.params.id, req.userId],
    );
    if (b.rows.length === 0) {
      res.status(404).json({ message: "Payment batch not found." });
      return;
    }
    const batch = b.rows[0];
    if (batch.status === "paid") {
      res.json({ status: "paid" });
      return;
    }
    let txStatus = "pending";
    try {
      txStatus = await getTransactionStatus(batch.order_id);
    } catch {
      /* transient — keep the caller polling */
    }
    if (["settlement", "capture"].includes(txStatus)) {
      await pool.query(
        `UPDATE registrations SET status = 'pending_review', updated_at = now()
          WHERE id = ANY($1::text[]) AND status = 'pending_payment' AND deleted_at IS NULL`,
        [batch.registration_ids],
      );
      await pool.query(
        "UPDATE rep_payment_batches SET status = 'paid', updated_at = now() WHERE id = $1",
        [batch.id],
      );
      res.json({ status: "paid" });
      return;
    }
    res.json({ status: txStatus });
  } catch (err) {
    console.error("Rep pay-batch verify error:", err);
    res.status(500).json({ message: "Failed to verify the payment" });
  }
});

// Achievement data — current cohort + historical claims for a rep's selected
// round. Shared by both the JSON view endpoint and the PDF export endpoint
// below so the two can never drift. `roundId` defaults to the local round when
// not provided, preserving the original behaviour.
async function repAchievementData(userId: string, roundId: string | null = null) {
  const a = await repAssignment(userId);
  if (!a) return null;
  const round = await resolveRepRound(a.comp_id, a.country, roundId);
  const meRow = await pool.query("SELECT full_name FROM users WHERE id = $1", [userId]);
  const repName: string = meRow.rows[0]?.full_name ?? "Country Representative";

  // Current-cohort results — every registration in this local round that
  // carries a score, ordered medalists first then by score desc.
  const current = round
    ? await pool.query(
        `SELECT u.full_name, r.score, r.is_medalist, r.status
           FROM registrations r
           JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
          WHERE r.round_id = $1 AND r.deleted_at IS NULL AND r.score IS NOT NULL
          ORDER BY r.is_medalist DESC NULLS LAST, r.score DESC NULLS LAST, u.full_name ASC
          LIMIT 1000`,
        [round.id],
      )
    : { rows: [] as any[] };

  // Historical claims — any prior result the students in this local round
  // already claimed on Competzy.
  const historical = round
    ? await pool.query(
        `SELECT u.full_name, hp.comp_name, hp.comp_year, hp.result, hp.event_part
           FROM registrations r
           JOIN users u ON u.id = r.user_id AND u.deleted_at IS NULL
           JOIN historical_participants hp ON hp.claimed_by = u.id
          WHERE r.round_id = $1 AND r.deleted_at IS NULL AND hp.result IS NOT NULL
          ORDER BY hp.comp_year DESC, u.full_name ASC
          LIMIT 1000`,
        [round.id],
      )
    : { rows: [] as any[] };

  return { a, round, repName, current, historical };
}

// ── Rep: GET /api/rep/achievements ────────────────────────────────────────
// JSON view of the same data the PDF export renders. Powers an in-portal
// achievements page so a rep can review results in the browser, then choose
// whether to download the PDF version.
router.get("/rep/achievements", async (req: Request, res: Response) => {
  try {
    const requestedRoundId =
      typeof req.query.roundId === "string" && req.query.roundId.trim()
        ? req.query.roundId.trim()
        : null;
    const data = await repAchievementData(req.userId!, requestedRoundId);
    if (!data) {
      res.status(404).json({ message: "No representative assignment found." });
      return;
    }
    const { a, round, repName, current, historical } = data;
    const medalCount = current.rows.filter((r: any) => r.is_medalist === true).length;
    const roundPayload = round
      ? {
          id: round.id,
          name: round.round_name,
          category: round.round_category ?? null,
          country: round.country ?? null,
          examMode: round.exam_mode,
          qualifyingScore: round.qualifying_score,
          examDate: round.exam_date,
        }
      : null;
    res.json({
      country: a.country,
      competition: { id: a.comp_id, name: a.comp_name },
      repName,
      // Renamed from `localRound` — the rep can now pick any accessible round.
      // `localRound` kept as alias for one release so the PDF/older clients
      // don't break mid-migration.
      selectedRound: roundPayload,
      localRound: roundPayload,
      summary: {
        scored: current.rows.length,
        medalists: medalCount,
        historical: historical.rows.length,
      },
      currentCohort: current.rows.map((r: any) => ({
        fullName: r.full_name,
        score: r.score,
        isMedalist: r.is_medalist,
        status: r.status,
      })),
      historical: historical.rows.map((r: any) => ({
        fullName: r.full_name,
        compName: r.comp_name,
        compYear: r.comp_year,
        result: r.result,
        eventPart: r.event_part,
      })),
    });
  } catch (err) {
    console.error("Rep achievements error:", err);
    res.status(500).json({ message: "Failed to load achievements" });
  }
});

// ── Rep: GET /api/rep/export/achievement.pdf ──────────────────────────────
// Achievement PDF parity with /api/{schools,teachers}/export/achievement.pdf,
// scoped to the rep's country + competition. Two sources: medalists from the
// local round (current cohort) and historical_participants claimed by students
// registered for this local round (prior performance).
router.get("/rep/export/achievement.pdf", async (req: Request, res: Response) => {
  try {
    const requestedRoundId =
      typeof req.query.roundId === "string" && req.query.roundId.trim()
        ? req.query.roundId.trim()
        : null;
    const data = await repAchievementData(req.userId!, requestedRoundId);
    if (!data) {
      res.status(404).json({ message: "No representative assignment found." });
      return;
    }
    const { a, round, repName, current, historical } = data;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="achievement-${a.country.toLowerCase()}-${a.comp_id.toLowerCase()}-${Date.now()}.pdf"`,
    );

    const doc = new PDFDocument({ margin: 48, size: "A4" });
    doc.pipe(res);

    doc.fontSize(9).fillColor("#94A3B8").text("COMPETZY", { align: "right" });
    doc.moveDown(0.6);
    doc.fontSize(22).fillColor("#0F172A").font("Helvetica-Bold")
      .text(`${a.comp_name} — ${a.country}`, { align: "left" });
    doc.fontSize(11).fillColor("#475569").font("Helvetica")
      .text(`Country Representative · ${repName}`, { align: "left" });
    doc.moveDown(0.4);
    doc.fontSize(16).fillColor("#0F172A").font("Helvetica-Bold")
      .text("Student Achievement Report");
    doc.fontSize(10).fillColor("#94A3B8").font("Helvetica")
      .text(
        `Generated ${new Date().toLocaleDateString("en-GB", {
          day: "numeric", month: "long", year: "numeric",
        })}`,
      );
    doc.moveDown(1);

    if (!round) {
      doc.fontSize(12).fillColor("#475569")
        .text("No local round has been configured yet for your country.");
      doc.end();
      return;
    }

    // Section 1 — current cohort.
    doc.fontSize(13).fillColor("#0F172A").font("Helvetica-Bold")
      .text(`${round.round_name} — current cohort`);
    doc.moveDown(0.4);

    if (current.rows.length === 0) {
      doc.fontSize(10).fillColor("#475569").font("Helvetica")
        .text("No scored results yet for the current cohort.");
    } else {
      doc.fontSize(10).fillColor("#0F172A").font("Helvetica-Bold");
      const head1Y = doc.y;
      doc.text("Student",     48,  head1Y, { width: 240 });
      doc.text("Score",       300, head1Y, { width: 80  });
      doc.text("Medal",       388, head1Y, { width: 80  });
      doc.text("Status",      476, head1Y, { width: 84  });
      doc.moveTo(48, doc.y + 4).lineTo(560, doc.y + 4)
        .strokeColor("#CBD5E1").lineWidth(0.5).stroke();
      doc.moveDown(0.6);

      doc.fontSize(10).font("Helvetica").fillColor("#0F172A");
      for (const row of current.rows) {
        const y = doc.y;
        doc.text(String(row.full_name ?? "—"),       48,  y, { width: 240 });
        doc.text(row.score != null ? String(row.score) : "—", 300, y, { width: 80 });
        doc.text(row.is_medalist ? "Medal" : "—",    388, y, { width: 80 });
        doc.text(String(row.status ?? "—").replace(/_/g, " "), 476, y, { width: 84 });
        doc.moveDown(0.7);
        if (doc.y > 760) doc.addPage();
      }
    }

    // Section 2 — historical claims.
    doc.moveDown(1);
    doc.fontSize(13).fillColor("#0F172A").font("Helvetica-Bold")
      .text("Prior achievements (historical records)");
    doc.moveDown(0.4);

    if (historical.rows.length === 0) {
      doc.fontSize(10).fillColor("#475569").font("Helvetica")
        .text("None of these students have claimed historical Competzy records.");
    } else {
      doc.fontSize(10).fillColor("#0F172A").font("Helvetica-Bold");
      const head2Y = doc.y;
      doc.text("Student",     48,  head2Y, { width: 180 });
      doc.text("Competition", 232, head2Y, { width: 200 });
      doc.text("Year",        436, head2Y, { width: 40  });
      doc.text("Result",      480, head2Y, { width: 80  });
      doc.moveTo(48, doc.y + 4).lineTo(560, doc.y + 4)
        .strokeColor("#CBD5E1").lineWidth(0.5).stroke();
      doc.moveDown(0.6);

      doc.fontSize(10).font("Helvetica").fillColor("#0F172A");
      for (const row of historical.rows) {
        const y = doc.y;
        doc.text(String(row.full_name ?? "—"), 48, y, { width: 180 });
        doc.text(
          `${row.comp_name ?? "—"}${row.event_part ? ` (${row.event_part})` : ""}`,
          232, y, { width: 200 },
        );
        doc.text(String(row.comp_year ?? "—"), 436, y, { width: 40 });
        doc.text(String(row.result ?? "—").toUpperCase(), 480, y, { width: 80 });
        doc.moveDown(0.7);
        if (doc.y > 760) doc.addPage();
      }
    }

    doc.moveDown(1.4);
    doc.fontSize(8).fillColor("#94A3B8")
      .text(
        "This report is generated from competition data registered on Competzy and historical competition records.",
        { align: "center" },
      );
    doc.end();
  } catch (err) {
    console.error("Rep achievement PDF error:", err);
    if (!res.headersSent)
      res.status(500).json({ message: "Failed to generate achievement PDF" });
  }
});

export default router;
