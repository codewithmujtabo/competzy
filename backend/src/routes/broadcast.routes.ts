import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { env } from "../config/env";
import { authMiddleware } from "../middleware/auth";
import { adminOrManager } from "../middleware/admin.middleware";
import { audit } from "../middleware/audit";
import { sendMailOrThrow } from "../services/email.service";
import {
  resolveAudience,
  renderBroadcastHtml,
  startBroadcast,
  type Audience,
  type AudienceKind,
} from "../services/broadcast.service";

// ── /api/admin/broadcasts — the kirim.email-style campaign composer ────────
// Admin + manager (outbound comms is administrative-staff work). Sends go
// through the background processor in broadcast.service.ts.

const router: Router = Router();
router.use(authMiddleware);
router.use(adminOrManager);

const KINDS: AudienceKind[] = [
  "all_students",
  "all_parents",
  "all_teachers",
  "all_users",
  "competition",
  "lapsed",
];

function parseAudience(raw: unknown): Audience | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (!KINDS.includes(a.kind as AudienceKind)) return null;
  const audience: Audience = { kind: a.kind as AudienceKind };
  if (a.kind === "competition") {
    if (typeof a.compId !== "string" || !a.compId) return null;
    audience.compId = a.compId;
    audience.paidOnly = a.paidOnly === true;
  }
  return audience;
}

// GET /api/admin/broadcasts — history, newest first.
router.get("/", async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT b.id, b.subject, b.audience, b.status,
              b.total_recipients, b.sent_count, b.failed_count,
              b.created_at, b.started_at, b.finished_at,
              u.full_name AS created_by_name
         FROM email_broadcasts b
    LEFT JOIN users u ON u.id = b.created_by
        ORDER BY b.created_at DESC
        LIMIT 100`
    );
    res.json({ broadcasts: r.rows });
  } catch (err) {
    console.error("broadcasts list error:", err);
    res.status(500).json({ message: "Failed to load broadcasts" });
  }
});

// GET /api/admin/broadcasts/audiences — live audience counts + competitions.
router.get("/audiences", async (_req: Request, res: Response) => {
  try {
    const [counts, comps] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE role = 'student') AS students,
          COUNT(*) FILTER (WHERE role = 'parent')  AS parents,
          COUNT(*) FILTER (WHERE role = 'teacher') AS teachers,
          COUNT(*) FILTER (WHERE role IN ('student','parent','teacher','school_admin')) AS all_users,
          COUNT(*) FILTER (
            WHERE role = 'student' AND NOT EXISTS (
              SELECT 1 FROM registrations r
               WHERE r.user_id = users.id AND r.deleted_at IS NULL
                 AND r.created_at > now() - interval '365 days')
          ) AS lapsed
        FROM users
        WHERE deleted_at IS NULL AND email IS NOT NULL AND email <> ''`),
      pool.query(
        `SELECT id, name FROM competitions ORDER BY created_at DESC`
      ),
    ]);
    const c = counts.rows[0];
    res.json({
      counts: {
        all_students: Number(c.students),
        all_parents: Number(c.parents),
        all_teachers: Number(c.teachers),
        all_users: Number(c.all_users),
        lapsed: Number(c.lapsed),
      },
      competitions: comps.rows,
    });
  } catch (err) {
    console.error("broadcast audiences error:", err);
    res.status(500).json({ message: "Failed to load audiences" });
  }
});

// POST /api/admin/broadcasts/preview — exact recipient count + sample.
router.post("/preview", async (req: Request, res: Response) => {
  try {
    const audience = parseAudience(req.body?.audience);
    if (!audience) {
      res.status(400).json({ message: "Invalid audience" });
      return;
    }
    const recipients = await resolveAudience(audience);
    res.json({
      count: recipients.length,
      sample: recipients.slice(0, 5).map((r) => ({ email: r.email, fullName: r.fullName })),
    });
  } catch (err) {
    console.error("broadcast preview error:", err);
    res.status(500).json({ message: "Failed to preview audience" });
  }
});

// POST /api/admin/broadcasts — create a draft.
router.post(
  "/",
  audit({ action: "admin.broadcast.create", resourceType: "email_broadcast" }),
  async (req: Request, res: Response) => {
    try {
      const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
      const html = typeof req.body?.html === "string" ? req.body.html.trim() : "";
      const audience = parseAudience(req.body?.audience);
      if (!subject || subject.length > 200) {
        res.status(400).json({ message: "Subject is required (max 200 chars)" });
        return;
      }
      if (!html || html.length > 200_000) {
        res.status(400).json({ message: "Body is required (max 200KB)" });
        return;
      }
      if (!audience) {
        res.status(400).json({ message: "Invalid audience" });
        return;
      }
      const r = await pool.query(
        `INSERT INTO email_broadcasts (created_by, subject, html, audience)
         VALUES ($1, $2, $3, $4)
         RETURNING id, subject, audience, status, created_at`,
        [req.userId, subject, html, JSON.stringify(audience)]
      );
      res.status(201).json({ broadcast: r.rows[0] });
    } catch (err) {
      console.error("broadcast create error:", err);
      res.status(500).json({ message: "Failed to create broadcast" });
    }
  }
);

// POST /api/admin/broadcasts/:id/test — send a single test email.
router.post("/:id/test", async (req: Request, res: Response) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ message: "A valid email is required" });
      return;
    }
    const b = await pool.query(`SELECT subject, html FROM email_broadcasts WHERE id = $1`, [
      req.params.id,
    ]);
    if (b.rows.length === 0) {
      res.status(404).json({ message: "Broadcast not found" });
      return;
    }
    await sendMailOrThrow({
      from: env.SMTP_FROM,
      to: email,
      subject: `[TEST] ${b.rows[0].subject}`,
      html: renderBroadcastHtml(b.rows[0].html, "Test Recipient"),
    });
    res.json({ message: "Test email sent" });
  } catch (err) {
    console.error("broadcast test error:", err);
    res.status(500).json({ message: "Failed to send the test email" });
  }
});

// POST /api/admin/broadcasts/:id/send — snapshot audience + start sending.
router.post(
  "/:id/send",
  audit({ action: "admin.broadcast.send", resourceType: "email_broadcast", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const total = await startBroadcast(String(req.params.id));
      res.json({ message: "Broadcast started", totalRecipients: total });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start broadcast";
      const known = ["Broadcast not found", "Broadcast already started", "Audience is empty"];
      if (known.includes(msg)) {
        res.status(400).json({ message: msg });
        return;
      }
      console.error("broadcast send error:", err);
      res.status(500).json({ message: "Failed to start broadcast" });
    }
  }
);

// POST /api/admin/broadcasts/:id/cancel — stop a sending broadcast.
router.post(
  "/:id/cancel",
  audit({ action: "admin.broadcast.cancel", resourceType: "email_broadcast", resourceIdParam: "id" }),
  async (req: Request, res: Response) => {
    try {
      const r = await pool.query(
        `UPDATE email_broadcasts SET status = 'cancelled', finished_at = now()
          WHERE id = $1 AND status IN ('draft', 'sending')
          RETURNING id`,
        [req.params.id]
      );
      if (r.rows.length === 0) {
        res.status(400).json({ message: "Broadcast is not cancellable" });
        return;
      }
      await pool.query(
        `UPDATE email_broadcast_recipients SET status = 'skipped'
          WHERE broadcast_id = $1 AND status = 'pending'`,
        [req.params.id]
      );
      res.json({ message: "Broadcast cancelled" });
    } catch (err) {
      console.error("broadcast cancel error:", err);
      res.status(500).json({ message: "Failed to cancel broadcast" });
    }
  }
);

// GET /api/admin/broadcasts/:id — detail with recipient stats.
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const b = await pool.query(
      `SELECT b.*, u.full_name AS created_by_name
         FROM email_broadcasts b
    LEFT JOIN users u ON u.id = b.created_by
        WHERE b.id = $1`,
      [req.params.id]
    );
    if (b.rows.length === 0) {
      res.status(404).json({ message: "Broadcast not found" });
      return;
    }
    const failures = await pool.query(
      `SELECT email, error FROM email_broadcast_recipients
        WHERE broadcast_id = $1 AND status = 'failed'
        ORDER BY id ASC LIMIT 20`,
      [req.params.id]
    );
    res.json({ broadcast: b.rows[0], recentFailures: failures.rows });
  } catch (err) {
    console.error("broadcast detail error:", err);
    res.status(500).json({ message: "Failed to load broadcast" });
  }
});

export default router;
