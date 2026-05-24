/**
 * Notifications Routes
 * Sprint 3, Track B, Phase 2 (T7.1-T7.4)
 *
 * API endpoints for in-app notification inbox.
 */

import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { authMiddleware } from "../middleware/auth";

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * T7.1 — GET /api/notifications
 * List user's notifications, paginated, newest first.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get total unread count
    const unreadResult = await pool.query(
      "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false",
      [req.userId]
    );

    const unreadCount = parseInt(unreadResult.rows[0].count);

    // Get paginated notifications
    const result = await pool.query(
      `SELECT id, type, title, body, data, read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );

    const notifications = result.rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data,
      read: n.read,
      createdAt: n.created_at,
    }));

    res.json({
      notifications,
      unreadCount,
      total: notifications.length,
      limit,
      offset,
    });
  } catch (err) {
    console.error("List notifications error:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

/**
 * T7.2 — POST /api/notifications/:id/read
 * Mark a notification as read.
 */
router.post("/:id/read", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET read = true, updated_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    res.json({ message: "Notification marked as read" });
  } catch (err) {
    console.error("Mark notification read error:", err);
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
});

/**
 * T7.3 — POST /api/notifications/read-all
 * Mark all user's notifications as read.
 */
router.post("/read-all", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET read = true, updated_at = now()
       WHERE user_id = $1 AND read = false
       RETURNING id`,
      [req.userId]
    );

    const count = result.rows.length;

    res.json({ message: "All notifications marked as read", count });
  } catch (err) {
    console.error("Mark all notifications read error:", err);
    res.status(500).json({ message: "Failed to mark all notifications as read" });
  }
});

/**
 * T7.4 — DELETE /api/notifications/:id
 * Delete a notification.
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    res.json({ message: "Notification deleted" });
  } catch (err) {
    console.error("Delete notification error:", err);
    res.status(500).json({ message: "Failed to delete notification" });
  }
});

export default router;
