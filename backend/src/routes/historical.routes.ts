import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";

const router: Router = Router();
router.use(authMiddleware);

// ── GET /api/historical/my-records ────────────────────────────────────────
// Returns all historical records claimed by the current user.
router.get("/my-records", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, source_id, full_name, email, phone, grade, gender,
              payment_status, result, school_name, comp_id, comp_name,
              comp_year, comp_category, event_part, claimed_at
       FROM historical_participants
       WHERE claimed_by = $1
       ORDER BY comp_year DESC, comp_name ASC`,
      [req.userId]
    );

    res.json(result.rows.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      grade: r.grade,
      gender: r.gender,
      paymentStatus: r.payment_status,
      result: r.result,
      schoolName: r.school_name,
      compId: r.comp_id,
      compName: r.comp_name,
      compYear: r.comp_year,
      compCategory: r.comp_category,
      eventPart: r.event_part,
      claimedAt: r.claimed_at,
    })));
  } catch (err) {
    console.error("GET /historical/my-records error:", err);
    res.status(500).json({ message: "Failed to fetch historical records" });
  }
});

// ── GET /api/historical/search ────────────────────────────────────────────
// Search unclaimed records by name and/or school for manual claiming.
// Query params: name (required), school (optional), compName (optional)
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { name, school, compName } = req.query;

    if (!name || String(name).trim().length < 3) {
      res.status(400).json({ message: "name query param must be at least 3 characters" });
      return;
    }

    const conditions: string[] = ["claimed_by IS NULL"];
    const params: unknown[] = [];
    let idx = 1;

    // Full-text search on name
    conditions.push(`to_tsvector('simple', full_name) @@ plainto_tsquery('simple', $${idx++})`);
    params.push(String(name).trim());

    if (school) {
      conditions.push(`school_name ILIKE $${idx++}`);
      params.push(`%${String(school).trim()}%`);
    }

    if (compName) {
      conditions.push(`comp_name ILIKE $${idx++}`);
      params.push(`%${String(compName).trim()}%`);
    }

    const result = await pool.query(
      `SELECT id, source_id, full_name, grade, gender, result,
              school_name, comp_id, comp_name, comp_year, comp_category, event_part
       FROM historical_participants
       WHERE ${conditions.join(" AND ")}
       ORDER BY comp_year DESC, comp_name ASC
       LIMIT 50`,
      params
    );

    res.json(result.rows.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      fullName: r.full_name,
      grade: r.grade,
      gender: r.gender,
      result: r.result,
      schoolName: r.school_name,
      compId: r.comp_id,
      compName: r.comp_name,
      compYear: r.comp_year,
      compCategory: r.comp_category,
      eventPart: r.event_part,
    })));
  } catch (err) {
    console.error("GET /historical/search error:", err);
    res.status(500).json({ message: "Failed to search historical records" });
  }
});

// ── POST /api/historical/:id/claim ────────────────────────────────────────
// Manually claim an unclaimed record. Rejected if already claimed by someone else.
router.post("/:id/claim", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `UPDATE historical_participants
       SET claimed_by = $1, claimed_at = now()
       WHERE id = $2 AND claimed_by IS NULL
       RETURNING id, comp_name, comp_year`,
      [req.userId, req.params.id]
    );

    if (result.rows.length === 0) {
      // Either not found or already claimed
      const existing = await pool.query(
        "SELECT claimed_by FROM historical_participants WHERE id = $1",
        [req.params.id]
      );
      if (existing.rows.length === 0) {
        res.status(404).json({ message: "Record not found" });
      } else {
        res.status(409).json({ message: "This record has already been claimed" });
      }
      return;
    }

    const r = result.rows[0];
    res.json({
      message: `Successfully claimed participation record for ${r.comp_name} ${r.comp_year ?? ""}`.trim(),
      id: r.id,
    });
  } catch (err) {
    console.error("POST /historical/:id/claim error:", err);
    res.status(500).json({ message: "Failed to claim record" });
  }
});

// ── POST /api/historical/:id/unclaim ──────────────────────────────────────
// Remove a wrongly claimed record. Only the owner can unclaim.
router.post("/:id/unclaim", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `UPDATE historical_participants
       SET claimed_by = NULL, claimed_at = NULL
       WHERE id = $1 AND claimed_by = $2
       RETURNING id`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Record not found or not claimed by you" });
      return;
    }

    res.json({ message: "Record unclaimed successfully", id: result.rows[0].id });
  } catch (err) {
    console.error("POST /historical/:id/unclaim error:", err);
    res.status(500).json({ message: "Failed to unclaim record" });
  }
});

export default router;
