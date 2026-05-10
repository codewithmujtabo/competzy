import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { env } from "../config/env";
import { authMiddleware } from "../middleware/auth";
import { pinVerifyLimiter } from "../middleware/rate-limit";
import crypto from "crypto";
import { isSmtpConfigured, sendParentInvitationEmail } from "../services/email.service";
import * as pushService from "../services/push.service";

const router = Router();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── POST /api/parents/invite-parent ──────────────────────────────────────
// Student sends invitation to parent email
router.post("/invite-parent", authMiddleware, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const studentId = req.userId!;
    const { parentEmail } = req.body;

    const normalizedEmail = normalizeEmail(parentEmail || "");

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      res.status(400).json({ message: "Valid parent email is required" });
      return;
    }

    // Verify the requester is a student
    const studentCheck = await pool.query(
      "SELECT full_name FROM users WHERE id = $1 AND role = 'student'",
      [studentId]
    );

    if (studentCheck.rows.length === 0) {
      res.status(403).json({ message: "Only students can send parent invitations" });
      return;
    }

    const studentName = studentCheck.rows[0].full_name;

    // Check for existing pending invitation to same email from same student (within last 24h)
    const existingInvite = await client.query(
      `SELECT id, created_at FROM invitations
       WHERE student_id = $1 AND parent_email = $2
       AND status = 'pending' AND expires_at > now()`,
      [studentId, normalizedEmail]
    );

    if (existingInvite.rows.length > 0) {
      res.status(409).json({
        message: "An invitation to this email was already sent. Please ask your parent to check their email inbox (and spam folder) for the PIN code. You can resend after 24 hours."
      });
      return;
    }

    // Generate 6-digit PIN
    const pin = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const debugMode = env.INVITATION_DEBUG_MODE;
    const smtpReady = isSmtpConfigured();

    await client.query("BEGIN");

    // Create invitation
    const result = await client.query(
      `INSERT INTO invitations (student_id, parent_email, verification_pin, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [studentId, normalizedEmail, pin, expiresAt]
    );

    let deliveryMethod: "email" | "debug" = "email";
    let emailSent = false;
    let smtpError: string | undefined;

    if (smtpReady) {
      try {
        await sendParentInvitationEmail(normalizedEmail, pin, studentName);
        emailSent = true;
      } catch (mailErr: any) {
        // SMTP credentials misconfigured or provider unreachable. Don't lose the
        // invitation: if debug mode is on, fall through and surface the PIN to
        // the student so they can share it manually.
        smtpError = mailErr?.message ?? "SMTP error";
        console.error("[Parent Invite] email send failed:", smtpError);
        if (!debugMode) {
          await client.query("ROLLBACK");
          res.status(502).json({
            message:
              "Could not send invitation email. The email service is not responding — please try again later or contact support.",
          });
          return;
        }
        deliveryMethod = "debug";
        console.log(
          `[Parent Invite Debug after SMTP failure] student=${studentId} parentEmail=${normalizedEmail} pin=${pin}`
        );
      }
    } else if (debugMode) {
      deliveryMethod = "debug";
      console.log(
        `[Parent Invite Debug] student=${studentId} parentEmail=${normalizedEmail} pin=${pin}`
      );
    } else {
      await client.query("ROLLBACK");
      res.status(500).json({
        message: "Parent invitation email service is not configured. Please contact support.",
      });
      return;
    }

    await client.query("COMMIT");

    res.status(201).json({
      invitationId: result.rows[0].id,
      message: emailSent
        ? "Invitation sent successfully"
        : smtpError
          ? "Email service unavailable — share the PIN below with your parent manually."
          : "Invitation created in debug mode. Use the PIN shown for testing.",
      deliveryMethod,
      emailSent,
      ...(debugMode ? { debugPin: pin, debugEmail: normalizedEmail } : {}),
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("Invite parent error:", err);
    res.status(500).json({ message: "Failed to send invitation" });
  } finally {
    client.release();
  }
});

// ── POST /api/parents/accept-invitation ──────────────────────────────────
// Parent accepts invitation using PIN
router.post("/accept-invitation", authMiddleware, pinVerifyLimiter, async (req: Request, res: Response) => {
  try {
    const parentId = req.userId!;
    const { email, pin } = req.body;

    if (!email || !pin) {
      res.status(400).json({ message: "Email and PIN are required" });
      return;
    }

    // Verify the requester is a parent
    const parentCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'parent'",
      [parentId]
    );

    if (parentCheck.rows.length === 0) {
      res.status(403).json({ message: "Only parent accounts can accept invitations" });
      return;
    }

    // Find valid invitation
    const inviteResult = await pool.query(
      `SELECT id, student_id FROM invitations
       WHERE parent_email = $1 AND verification_pin = $2
       AND status = 'pending' AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [normalizeEmail(email), pin]
    );

    if (inviteResult.rows.length === 0) {
      res.status(400).json({ message: "Invalid or expired PIN" });
      return;
    }

    const invitation = inviteResult.rows[0];

    // Check if link already exists
    const existingLink = await pool.query(
      `SELECT id, status FROM parent_student_links
       WHERE parent_id = $1 AND student_id = $2`,
      [parentId, invitation.student_id]
    );

    if (existingLink.rows.length > 0) {
      res.status(409).json({
        message: "Link already exists",
        status: existingLink.rows[0].status
      });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Mark invitation as accepted
      await client.query(
        "UPDATE invitations SET status = 'accepted', accepted_at = now() WHERE id = $1",
        [invitation.id]
      );

      // Create parent-student link with pending status (requires student approval)
      const linkResult = await client.query(
        `INSERT INTO parent_student_links (parent_id, student_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING id`,
        [parentId, invitation.student_id]
      );

      await client.query("COMMIT");

      res.status(201).json({
        linkId: linkResult.rows[0].id,
        status: "pending",
        message: "Link created. Waiting for student approval."
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Accept invitation error:", err);
    res.status(500).json({ message: "Failed to accept invitation" });
  }
});

// ── GET /api/parents/my-children ─────────────────────────────────────────
// Parent views linked children
router.get("/my-children", authMiddleware, async (req: Request, res: Response) => {
  try {
    const parentId = req.userId!;
    const { status } = req.query;
    const studentColumnsResult = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'students'`
    );
    const studentColumns = new Set(
      studentColumnsResult.rows.map((row) => row.column_name)
    );
    const schoolColumn = studentColumns.has("school_name") ? "s.school_name" : "s.school";

    // Single query with JOIN to fetch all data at once (fixes N+1 problem)
    let query = `
      SELECT
        psl.id as link_id,
        psl.status as link_status,
        psl.created_at as linked_at,
        u.id as student_id,
        u.full_name,
        u.email,
        u.phone,
        ${schoolColumn} as school_name,
        s.grade,
        s.nisn,
        r.id as registration_id,
        r.comp_id,
        r.status as reg_status,
        r.created_at as registered_at,
        c.name as competition_name,
        c.category,
        c.grade_level,
        c.reg_close_date
      FROM parent_student_links psl
      JOIN users u ON psl.student_id = u.id
      LEFT JOIN students s ON u.id = s.id
      LEFT JOIN registrations r ON u.id = r.user_id
      LEFT JOIN competitions c ON r.comp_id = c.id
      WHERE psl.parent_id = $1
    `;

    const params: any[] = [parentId];

    if (status) {
      query += " AND psl.status = $2";
      params.push(status);
    }

    query += " ORDER BY psl.created_at DESC, r.created_at DESC NULLS LAST";

    const result = await pool.query(query, params);

    // Group results by student
    const childrenMap = new Map();
    for (const row of result.rows) {
      if (!childrenMap.has(row.student_id)) {
        childrenMap.set(row.student_id, {
          linkId: row.link_id,
          linkStatus: row.link_status,
          linkedAt: row.linked_at,
          studentId: row.student_id,
          fullName: row.full_name,
          email: row.email,
          phone: row.phone,
          school: row.school_name,
          grade: row.grade,
          nisn: row.nisn,
          registrations: []
        });
      }

      // Add registration if exists
      if (row.registration_id) {
        childrenMap.get(row.student_id).registrations.push({
          registrationId: row.registration_id,
          competitionId: row.comp_id,
          competitionName: row.competition_name,
          category: row.category,
          level: row.grade_level,
          status: row.reg_status,
          registeredAt: row.registered_at,
          regCloseDate: row.reg_close_date
        });
      }
    }

    res.json(Array.from(childrenMap.values()));
  } catch (err) {
    console.error("Get my children error:", err);
    res.status(500).json({
      message:
        env.NODE_ENV !== "production"
          ? err instanceof Error
            ? err.message
            : "Failed to fetch children"
          : "Failed to fetch children",
    });
  }
});

// ── GET /api/parents/pending-invitations ─────────────────────────────────
// Student views pending parent link approvals
router.get("/pending-invitations", authMiddleware, async (req: Request, res: Response) => {
  try {
    const studentId = req.userId!;

    const result = await pool.query(
      `SELECT
        psl.id as link_id,
        psl.created_at,
        u.id as parent_id,
        u.full_name as parent_name,
        u.email as parent_email
      FROM parent_student_links psl
      JOIN users u ON psl.parent_id = u.id
      WHERE psl.student_id = $1 AND psl.status = 'pending'
      ORDER BY psl.created_at DESC`,
      [studentId]
    );

    res.json(result.rows.map(row => ({
      linkId: row.link_id,
      parentId: row.parent_id,
      parentName: row.parent_name,
      parentEmail: row.parent_email,
      createdAt: row.created_at
    })));
  } catch (err) {
    console.error("Get pending invitations error:", err);
    res.status(500).json({ message: "Failed to fetch pending invitations" });
  }
});

// ── GET /api/parents/debug/recent-invitations ─────────────────────────────
// Development/testing helper for students to retrieve invitation PINs
router.get("/debug/recent-invitations", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (env.NODE_ENV === "production" || !env.INVITATION_DEBUG_MODE) {
      res.status(404).json({ message: "Not found" });
      return;
    }

    const studentId = req.userId!;
    const emailQuery = typeof req.query.email === "string" ? normalizeEmail(req.query.email) : null;

    const studentCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'student'",
      [studentId]
    );

    if (studentCheck.rows.length === 0) {
      res.status(403).json({ message: "Only students can view invitation debug data" });
      return;
    }

    const params: any[] = [studentId];
    let query = `
      SELECT
        id,
        parent_email,
        verification_pin,
        status,
        expires_at,
        created_at
      FROM invitations
      WHERE student_id = $1
    `;

    if (emailQuery) {
      query += " AND parent_email = $2";
      params.push(emailQuery);
    }

    query += " ORDER BY created_at DESC LIMIT 10";

    const result = await pool.query(query, params);

    res.json({
      invitations: result.rows.map((row) => ({
        invitationId: row.id,
        parentEmail: row.parent_email,
        pin: row.verification_pin,
        status: row.status,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error("Get debug invitations error:", err);
    res.status(500).json({ message: "Failed to fetch debug invitations" });
  }
});

// ── PUT /api/parents/links/:linkId/approve ───────────────────────────────
// Student approves or rejects parent link
router.put("/links/:linkId/approve", authMiddleware, async (req: Request, res: Response) => {
  try {
    const studentId = req.userId!;
    const { linkId } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'rejected'].includes(status)) {
      res.status(400).json({ message: "Status must be 'active' or 'rejected'" });
      return;
    }

    // Verify the link belongs to this student and is pending
    const linkCheck = await pool.query(
      `SELECT psl.id, psl.parent_id, u.full_name as student_name
       FROM parent_student_links psl
       JOIN users u ON u.id = psl.student_id
       WHERE psl.id = $1 AND psl.student_id = $2 AND psl.status = 'pending'`,
      [linkId, studentId]
    );

    if (linkCheck.rows.length === 0) {
      res.status(404).json({ message: "Link not found or already processed" });
      return;
    }

    // Update link status
    const updateResult = await pool.query(
      `UPDATE parent_student_links
       SET status = $1, approved_at = now()
       WHERE id = $2
       RETURNING *`,
      [status, linkId]
    );

    const parentId = linkCheck.rows[0].parent_id;
    const studentName = linkCheck.rows[0].student_name || "Your child";

    await pushService.sendPushNotification(
      parentId,
      status === "active" ? "Parent Link Approved" : "Parent Link Rejected",
      status === "active"
        ? `${studentName} approved your parent link request. You can now follow their competition activity.`
        : `${studentName} rejected your parent link request.`,
      {
        type: status === "active" ? "parent_link_approved" : "parent_link_rejected",
        studentId,
        linkId,
      }
    );

    res.json({
      linkId: updateResult.rows[0].id,
      status: updateResult.rows[0].status,
      approvedAt: updateResult.rows[0].approved_at,
      message: status === 'active' ? 'Parent link approved' : 'Parent link rejected'
    });
  } catch (err) {
    console.error("Approve link error:", err);
    res.status(500).json({ message: "Failed to update link status" });
  }
});

export default router;
