import { freshPublicUrl } from "../services/storage.service";
import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";

const router: Router = Router();

// GET /api/favorites - List user's favorites with competition details
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const result = await pool.query(
      `SELECT
        f.id as favorite_id,
        f.created_at as favorited_at,
        c.*
      FROM favorites f
      JOIN competitions c ON f.comp_id = c.id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC`,
      [userId]
    );

    const favorites = await Promise.all(
      result.rows.map(async (r) => ({ ...r, logo_url: await freshPublicUrl(r.logo_url) }))
    );
    res.json({ favorites });
  } catch (err) {
    console.error("Get favorites error:", err);
    res.status(500).json({ message: "Failed to fetch favorites" });
  }
});

// POST /api/favorites - Add competition to favorites
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { compId } = req.body;

    if (!compId) {
      res.status(400).json({ message: "compId is required" });
      return;
    }

    // Check if competition exists
    const compCheck = await pool.query(
      "SELECT id FROM competitions WHERE id = $1",
      [compId]
    );

    if (compCheck.rows.length === 0) {
      res.status(404).json({ message: "Competition not found" });
      return;
    }

    // Insert favorite (ON CONFLICT prevents duplicates)
    await pool.query(
      `INSERT INTO favorites (user_id, comp_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, comp_id) DO NOTHING`,
      [userId, compId]
    );

    res.status(201).json({ message: "Added to favorites" });
  } catch (err) {
    console.error("Add favorite error:", err);
    res.status(500).json({ message: "Failed to add favorite" });
  }
});

// DELETE /api/favorites/:compId - Remove from favorites
router.delete("/:compId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { compId } = req.params;

    await pool.query(
      "DELETE FROM favorites WHERE user_id = $1 AND comp_id = $2",
      [userId, compId]
    );

    res.json({ message: "Removed from favorites" });
  } catch (err) {
    console.error("Remove favorite error:", err);
    res.status(500).json({ message: "Failed to remove favorite" });
  }
});

// GET /api/favorites/check/:compId - Check if favorited
router.get("/check/:compId", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { compId } = req.params;

    const result = await pool.query(
      "SELECT id FROM favorites WHERE user_id = $1 AND comp_id = $2",
      [userId, compId]
    );

    res.json({ isFavorited: result.rows.length > 0 });
  } catch (err) {
    console.error("Check favorite error:", err);
    res.status(500).json({ message: "Failed to check favorite" });
  }
});

export default router;
