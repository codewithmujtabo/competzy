import { Router, Request, Response } from "express";
import { z } from "zod";

import { pool } from "../config/database";
import { env } from "../config/env";
import { sendMailOrThrow } from "../services/email.service";
import { contactLimiter } from "../middleware/rate-limit";

// ─────────────────────────────────────────────────────────────────────────
// Public contact form for the /help page (arena.competzy.com/help).
//
//   POST /api/contact   receive a message, persist it, email support.
//
// Public (no authMiddleware) and rate-limited. The message is stored in
// contact_messages first (durable), then emailed fire-and-forget to
// env.SUPPORT_EMAIL so a slow or broken SMTP never fails a submission we
// have already saved.
// ─────────────────────────────────────────────────────────────────────────

const router: Router = Router();

const ContactPayload = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
});

// Escape user text before embedding it in the notification email's HTML body.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── POST /api/contact ────────────────────────────────────────────────────
router.post("/", contactLimiter, async (req: Request, res: Response) => {
  const parsed = ContactPayload.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", issues: parsed.error.flatten() });
    return;
  }
  const { name, email, subject, message } = parsed.data;

  // 1. Persist first so the message survives even if email delivery fails.
  try {
    await pool.query(
      `INSERT INTO contact_messages (name, email, subject, message)
       VALUES ($1, $2, $3, $4)`,
      [name, email, subject ?? null, message]
    );
  } catch (err) {
    console.error("Contact insert error:", err);
    res.status(500).json({ message: "Could not send your message. Please try again." });
    return;
  }

  // 2. Notify support fire-and-forget. sendMailOrThrow throws when SMTP is
  //    unset or failing, so we never let it 500 an already-saved submission.
  //    replyTo is the sender so support can reply straight to them (the from
  //    address must stay on the verified SMTP domain for SPF/DKIM).
  const subjectLine = subject && subject.length > 0 ? subject : "New contact-form message";
  void sendMailOrThrow({
    from: env.SMTP_FROM,
    to: env.SUPPORT_EMAIL,
    replyTo: email,
    subject: `[Contact] ${subjectLine}`,
    text: `From: ${name} <${email}>\nSubject: ${subjectLine}\n\n${message}`,
    html:
      `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>` +
      `<p><strong>Subject:</strong> ${escapeHtml(subjectLine)}</p>` +
      `<hr>` +
      `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
  }).catch((mailErr) => {
    console.error("Contact email send failed:", mailErr);
  });

  res.status(201).json({ message: "Message sent" });
});

export default router;
