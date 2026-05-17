import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import * as recommendationsService from "../services/recommendations.service";
import * as pushService from "../services/push.service";

const router = Router();

// Simple in-memory cache for recommendations (1 hour TTL)
const recommendationsCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ── GET /api/competitions/recommended ────────────────────────────────────
// Sprint 4, Track B (T6) - Get personalized recommendations
router.get("/recommended", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 10;

    // Check cache
    const cacheKey = `${userId}:${limit}`;
    const cached = recommendationsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.json(cached.data);
      return;
    }

    // Get recommendations
    const recommendations = await recommendationsService.getRecommendations(
      userId,
      limit
    );

    // Cache the result
    recommendationsCache.set(cacheKey, {
      data: recommendations,
      timestamp: Date.now(),
    });

    // Clean up expired cache entries periodically
    if (Math.random() < 0.1) {
      // 10% chance
      const now = Date.now();
      for (const [key, value] of recommendationsCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          recommendationsCache.delete(key);
        }
      }
    }

    res.json(recommendations);
  } catch (err) {
    console.error("Get recommendations error:", err);
    res.status(500).json({ message: "Failed to get recommendations" });
  }
});

// ── GET /api/competitions ─────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, grade, slug } = req.query;

    let query = "SELECT * FROM competitions";
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (category) {
      conditions.push(`category = $${idx++}`);
      values.push(category);
    }
    if (grade) {
      conditions.push(`grade_level LIKE $${idx++}`);
      values.push(`%${grade}%`);
    }
    if (slug) {
      conditions.push(`slug = $${idx++}`);
      values.push(slug);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, values);

    const competitions = result.rows.map((c) => ({
      id: c.id,
      slug: c.slug ?? null,
      name: c.name,
      organizerName: c.organizer_name,
      category: c.category,
      gradeLevel: c.grade_level,
      fee: c.fee,
      quota: c.quota,
      regOpenDate: c.reg_open_date,
      regCloseDate: c.reg_close_date,
      competitionDate: c.competition_date,
      requiredDocs: c.required_docs,
      description: c.description,
      registrationStatus: c.registration_status,
      isInternational: c.is_international,
      imageUrl: c.image_url,
      participantInstructions: c.participant_instructions,
      kind: c.kind ?? "native",
      createdAt: c.created_at,
    }));

    res.json(competitions);
  } catch (err) {
    console.error("List competitions error:", err);
    res.status(500).json({ message: "Failed to fetch competitions" });
  }
});

// ── GET /api/competitions/:id ─────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const competitionResult = await pool.query(
      "SELECT * FROM competitions WHERE id = $1",
      [req.params.id]
    );

    if (competitionResult.rows.length === 0) {
      res.status(404).json({ message: "Competition not found" });
      return;
    }

    const c = competitionResult.rows[0];
    const roundsTableExists = await pool.query(
      "SELECT to_regclass('public.competition_rounds') as table_name"
    );
    const hasCompetitionRounds = !!roundsTableExists.rows[0]?.table_name;
    const rounds = hasCompetitionRounds
      ? (
          await pool.query(
            `SELECT
              id,
              round_name,
              round_type,
              start_date,
              registration_deadline,
              exam_date,
              results_date,
              fee,
              location,
              round_order
            FROM competition_rounds
            WHERE comp_id = $1
            ORDER BY round_order ASC, created_at ASC`,
            [req.params.id]
          )
        ).rows
      : [];

    res.json({
      id: c.id,
      name: c.name,
      organizerName: c.organizer_name,
      category: c.category,
      gradeLevel: c.grade_level,
      fee: c.fee,
      quota: c.quota,
      regOpenDate: c.reg_open_date,
      regCloseDate: c.reg_close_date,
      competitionDate: c.competition_date,
      requiredDocs: c.required_docs,
      description: c.description,
      detailedDescription: c.detailed_description,
      kind: c.kind ?? "native",
      registrationStatus: c.registration_status,
      isInternational: c.is_international,
      imageUrl: c.image_url,
      websiteUrl: c.website_url,
      participantInstructions: c.participant_instructions,
      rounds: rounds.map((round) => ({
        id: round.id,
        roundName: round.round_name,
        roundType: round.round_type,
        startDate: round.start_date,
        registrationDeadline: round.registration_deadline,
        examDate: round.exam_date,
        resultsDate: round.results_date,
        fee: round.fee,
        location: round.location,
        roundOrder: round.round_order,
      })),
      createdAt: c.created_at,
    });
  } catch (err) {
    console.error("Get competition error:", err);
    res.status(500).json({ message: "Failed to fetch competition" });
  }
});

// ── POST /api/competitions/:id/view ──────────────────────────────────────
// Sprint 4, Track A (T2) - Track competition views
router.post("/:id/view", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { duration = 0 } = req.body;
    const userId = req.userId;

    // Check if competition exists
    const compResult = await pool.query(
      "SELECT id FROM competitions WHERE id = $1",
      [id]
    );

    if (compResult.rows.length === 0) {
      res.status(404).json({ message: "Competition not found" });
      return;
    }

    // Check if user already viewed this competition in the last 24 hours
    const existingView = await pool.query(
      `SELECT id FROM competition_views
       WHERE user_id = $1 AND comp_id = $2
       AND viewed_at > NOW() - INTERVAL '24 hours'
       ORDER BY viewed_at DESC
       LIMIT 1`,
      [userId, id]
    );

    if (existingView.rows.length > 0) {
      // Update existing view record with new duration
      await pool.query(
        `UPDATE competition_views
         SET view_duration_seconds = $1, viewed_at = NOW()
         WHERE id = $2`,
        [duration, existingView.rows[0].id]
      );
    } else {
      // Insert new view record
      await pool.query(
        `INSERT INTO competition_views (user_id, comp_id, view_duration_seconds)
         VALUES ($1, $2, $3)`,
        [userId, id, duration]
      );
    }

    res.json({ message: "View tracked successfully" });
  } catch (err) {
    console.error("Track view error:", err);
    res.status(500).json({ message: "Failed to track view" });
  }
});

// ── POST /api/competitions ───────────────────────────────────────────────
// Sprint 4, Track D (T12) - Create new competition (admin only)
// For MVP: No auth check, but in production should require admin role
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      name,
      organizerName,
      category,
      gradeLevel,
      fee = 0,
      quota,
      regOpenDate,
      regCloseDate,
      competitionDate,
      requiredDocs = [],
      description,
      imageUrl,
    } = req.body;

    // Validate required fields
    if (!name || !organizerName || !category) {
      res.status(400).json({
        message: "Missing required fields: name, organizerName, category",
      });
      return;
    }

    // Insert competition
    const result = await pool.query(
      `INSERT INTO competitions
       (name, organizer_name, category, grade_level, fee, quota,
        reg_open_date, reg_close_date, competition_date, required_docs,
        description, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        name,
        organizerName,
        category,
        gradeLevel,
        fee,
        quota,
        regOpenDate,
        regCloseDate,
        competitionDate,
        requiredDocs,
        description,
        imageUrl,
      ]
    );

    const compId = result.rows[0].id;

    // Sprint 4, Track D (T13, T14) - Send new competition alerts
    // Get interested users
    const interestedUserIds = await recommendationsService.getUsersInterestedIn(compId);

    if (interestedUserIds.length > 0) {
      // Send batch notification
      await pushService.sendBatchNotifications(
        interestedUserIds,
        `New ${category} Competition!`,
        `${name} is now open for registration`,
        { type: "new_competition", compId }
      );

      console.log(
        `Sent new competition alert to ${interestedUserIds.length} users for ${name}`
      );
    }

    res.status(201).json({
      message: "Competition created successfully",
      id: compId,
      notificationsSent: interestedUserIds.length,
    });
  } catch (err: any) {
    console.error("Create competition error:", err);
    res.status(500).json({ message: "Failed to create competition" });
  }
});

export default router;
