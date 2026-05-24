import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { env } from "../config/env";
import { authMiddleware } from "../middleware/auth";
import { verifyToken } from "../services/auth.service";
import * as recommendationsService from "../services/recommendations.service";
import * as pushService from "../services/push.service";
import { classifyCreature } from "../services/komodo-creature.service";

// Best-effort caller country — returns the ISO country code on `users.country`
// if a valid session is attached to the request, else null. Never throws,
// because the catalog endpoint is reachable anonymously.
async function callerCountry(req: Request): Promise<string | null> {
  try {
    let token: string | null = null;
    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ")) token = header.slice(7);
    else if ((req as any).cookies?.competzy_token) token = (req as any).cookies.competzy_token;
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    const r = await pool.query(
      "SELECT country FROM users WHERE id = $1 AND deleted_at IS NULL",
      [payload.sub]
    );
    return (r.rows[0]?.country ?? null) || null;
  } catch {
    return null;
  }
}

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

    // International-only filter, mirroring `GET /api/competitions` (line ~113).
    // A non-Indonesian student should never be recommended a local-only comp —
    // they can't register for it anyway, so showing it in the For-You row is
    // misleading. Read country FIRST so it can salt the cache key — otherwise
    // a profile country change leaves a stale recommendation list cached for
    // up to an hour.
    const country = await callerCountry(req);
    const isIntl = !!(country && country.toUpperCase() !== "ID");

    // Cache key includes country bucket so changing country invalidates.
    const cacheKey = `${userId}:${limit}:${isIntl ? "intl" : "any"}`;
    const cached = recommendationsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      res.json(cached.data);
      return;
    }

    // Get recommendations
    let recommendations = await recommendationsService.getRecommendations(
      userId,
      limit
    );

    if (isIntl) {
      recommendations = recommendations.filter(
        (c: any) => c.is_international === true,
      );
    }

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

    // International-only filter: an authenticated caller whose `users.country`
    // is set to anything other than Indonesia (`ID`) sees only competitions
    // flagged `is_international = true`. Anonymous + ID + null-country callers
    // see everything (the previous behaviour). This is the server-side hook
    // both web + mobile catalogs inherit.
    const country = await callerCountry(req);
    if (country && country.toUpperCase() !== "ID") {
      conditions.push(`is_international = true`);
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
      logoUrl: c.logo_url ?? null,
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
              fee_international,
              location,
              round_order,
              requires_round_id,
              gating,
              required_docs,
              round_category,
              country,
              exam_mode,
              qualifying_score,
              is_active,
              age_cutoff_date,
              description
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
      // Profile fields the student must have on file before they can register.
      // Empty for most comps; populated for Komodo & friends. The web dashboard
      // uses this to render the confirm-your-profile dialog with every field
      // pre-filled — not only the ones currently missing.
      requiredProfileFields: Array.isArray(c.required_profile_fields)
        ? c.required_profile_fields
        : [],
      description: c.description,
      detailedDescription: c.detailed_description,
      kind: c.kind ?? "native",
      registrationStatus: c.registration_status,
      isInternational: c.is_international,
      // USD → IDR rate the backend uses when charging an international student
      // (Stripe isn't onboardable for an Indonesian merchant). Frontends use
      // this to render "Rp X (~$Y USD)" labels so the student sees the same
      // number Midtrans will show in the Snap popup.
      usdToIdrRate: env.USD_TO_IDR_RATE,
      imageUrl: c.image_url,
      logoUrl: c.logo_url ?? null,
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
        feeInternational:
          round.fee_international != null ? Number(round.fee_international) : null,
        location: round.location,
        roundOrder: round.round_order,
        requiresRoundId: round.requires_round_id ?? null,
        gating: round.gating ?? null,
        requiredDocs: round.required_docs ?? [],
        roundCategory: round.round_category ?? 'online',
        country: round.country ?? null,
        examMode: round.exam_mode ?? 'online',
        qualifyingScore: round.qualifying_score ?? null,
        isActive: round.is_active !== false,
        ageCutoffDate: round.age_cutoff_date ?? null,
        description: round.description ?? null,
      })),
      createdAt: c.created_at,
    });
  } catch (err) {
    console.error("Get competition error:", err);
    res.status(500).json({ message: "Failed to fetch competition" });
  }
});

// ── GET /api/competitions/:id/my-creature ────────────────────────────────
// Returns the per-round creature classification for the calling student based
// on their date_of_birth and each round's age_cutoff_date. Empty list when
// the competition has no age-cutoff rounds (e.g. ISPO / EMC). The endpoint
// is open to any authed user — non-students with no DOB simply get empty
// creature entries (the array still surfaces the rounds + cutoffs).
router.get("/:id/my-creature", authMiddleware, async (req: Request, res: Response) => {
  try {
    const dobRes = await pool.query(
      "SELECT date_of_birth FROM students WHERE id = $1",
      [req.userId],
    );
    const dob: Date | null = dobRes.rows[0]?.date_of_birth ?? null;

    const rounds = await pool.query(
      `SELECT id, round_name, round_order, age_cutoff_date::text AS age_cutoff_date
         FROM competition_rounds
        WHERE comp_id = $1 AND age_cutoff_date IS NOT NULL
        ORDER BY round_order ASC, created_at ASC`,
      [req.params.id],
    );

    res.json({
      rounds: rounds.rows.map((r) => {
        const creature = classifyCreature(dob, r.age_cutoff_date);
        return {
          roundId: r.id,
          roundName: r.round_name,
          ageCutoffDate: r.age_cutoff_date,
          creature: creature
            ? {
                key: creature.key,
                name: creature.name,
                ageRange: creature.ageRange,
                photoUrl: creature.photoUrl,
                placeholder: creature.placeholder ?? false,
                ageAtCutoff: creature.ageAtCutoff,
              }
            : null,
          // null when the student has no DOB on file OR the computed age is
          // out of bracket — the UI surfaces "Add your date of birth" in
          // that case.
          missingDob: !dob,
        };
      }),
    });
  } catch (err) {
    console.error("My creature error:", err);
    res.status(500).json({ message: "Failed to load creature" });
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
