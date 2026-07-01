import { createHmac, timingSafeEqual } from "crypto";
import { pool } from "../config/database";
import { env } from "../config/env";
import { sendMailOrThrow, isSmtpConfigured } from "./email.service";

// ── Email broadcast engine (kirim.email-style campaigns) ───────────────────
//
// Send path: the Resend BATCH API (https://resend.com/docs/api-reference/emails/send-batch)
// when the SMTP password is a Resend API key (re_...) — one HTTPS call sends up
// to 100 emails, far under Resend's 2 req/s limit at our tick rate. Falls back
// to plain nodemailer per-recipient otherwise, so the feature works on any SMTP.
//
// State machine: draft → sending → sent | failed | cancelled.
// Recipients are snapshotted into email_broadcast_recipients when the send
// starts; the interval processor drains `pending` rows in batches and updates
// counters, so progress survives restarts and is exactly countable.

export type AudienceKind =
  | "all_students"
  | "all_parents"
  | "all_teachers"
  | "all_users"
  | "competition"
  | "lapsed";

export interface Audience {
  kind: AudienceKind;
  compId?: string;
  /** competition kind only — restrict to settled/paid registrants. */
  paidOnly?: boolean;
}

interface Recipient {
  userId: string;
  email: string;
  fullName: string | null;
}

const BATCH_SIZE = 90; // Resend batch cap is 100 — headroom for safety.
const TICK_MS = 15_000;

// ── Unsubscribe tokens (RFC 8058 one-click) ─────────────────────────────────
// Stateless HMAC over the email so footer links + List-Unsubscribe headers
// need no per-recipient DB writes at send time. Keyed on JWT_SECRET.

function unsubSig(email: string): string {
  return createHmac("sha256", env.JWT_SECRET).update(email.toLowerCase()).digest("base64url");
}

export function unsubscribeToken(email: string): string {
  return `${Buffer.from(email.toLowerCase()).toString("base64url")}.${unsubSig(email)}`;
}

/** Returns the verified email, or null on a bad/tampered token. */
export function verifyUnsubscribeToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  try {
    const email = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
    const given = Buffer.from(token.slice(dot + 1), "base64url");
    const want = Buffer.from(unsubSig(email), "base64url");
    if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
    return email;
  } catch {
    return null;
  }
}

export async function suppressEmail(email: string, source: "link" | "one-click"): Promise<void> {
  await pool.query(
    `INSERT INTO email_unsubscribes (email, source) VALUES (lower($1), $2)
     ON CONFLICT (email) DO NOTHING`,
    [email, source]
  );
}

function unsubscribeUrl(email: string): string {
  // The API endpoint accepts both the one-click POST (RFC 8058) and a human
  // GET (302 → the arena confirmation page).
  const api = env.APP_URL.includes("localhost")
    ? "http://localhost:3010"
    : "https://api.competzy.com";
  return `${api}/api/email/unsubscribe?token=${unsubscribeToken(email)}`;
}

// ── Audience resolution — always live from the DB ───────────────────────────

export async function resolveAudience(a: Audience): Promise<Recipient[]> {
  const base = `SELECT u.id AS user_id, u.email, u.full_name
                  FROM users u
                 WHERE u.deleted_at IS NULL
                   AND u.email IS NOT NULL AND u.email <> ''
                   AND NOT EXISTS (
                     SELECT 1 FROM email_unsubscribes eu WHERE eu.email = lower(u.email)
                   )`;

  switch (a.kind) {
    case "all_students":
    case "all_parents":
    case "all_teachers": {
      const role = a.kind.replace("all_", "").replace(/s$/, "");
      const r = await pool.query(`${base} AND u.role = $1`, [role]);
      return r.rows.map(mapRow);
    }
    case "all_users": {
      const r = await pool.query(
        `${base} AND u.role IN ('student', 'parent', 'teacher', 'school_admin')`
      );
      return r.rows.map(mapRow);
    }
    case "competition": {
      if (!a.compId) return [];
      const statusFilter = a.paidOnly ? `AND r.status = 'paid'` : "";
      const r = await pool.query(
        `SELECT DISTINCT u.id AS user_id, u.email, u.full_name
           FROM registrations r
           JOIN users u ON u.id = r.user_id
          WHERE r.comp_id = $1 AND r.deleted_at IS NULL
            AND u.deleted_at IS NULL AND u.email IS NOT NULL AND u.email <> ''
            AND NOT EXISTS (
              SELECT 1 FROM email_unsubscribes eu WHERE eu.email = lower(u.email)
            )
            ${statusFilter}`,
        [a.compId]
      );
      return r.rows.map(mapRow);
    }
    case "lapsed": {
      // Students with an account but no registration in the last 12 months —
      // the re-engagement audience.
      const r = await pool.query(
        `${base} AND u.role = 'student'
           AND NOT EXISTS (
             SELECT 1 FROM registrations r
              WHERE r.user_id = u.id AND r.deleted_at IS NULL
                AND r.created_at > now() - interval '365 days'
           )`
      );
      return r.rows.map(mapRow);
    }
    default:
      return [];
  }
}

function mapRow(r: { user_id: string; email: string; full_name: string | null }): Recipient {
  return { userId: r.user_id, email: r.email, fullName: r.full_name };
}

// ── Branded email wrapper ───────────────────────────────────────────────────

/** Wraps campaign HTML in the Competzy shell. `{{name}}` personalizes. */
export function renderBroadcastHtml(bodyHtml: string, fullName: string | null, unsubUrl?: string): string {
  const personalized = bodyHtml.split("{{name}}").join(escapeHtml(fullName || "Kompetitor"));
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f1fb;font-family:'Plus Jakarta Sans',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:linear-gradient(135deg,#5627ff,#3a1bb8);border-radius:16px 16px 0 0;padding:20px 28px;">
      <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">Competzy</span>
    </div>
    <div style="background:#ffffff;border-radius:0 0 16px 16px;padding:28px;color:#181219;font-size:15px;line-height:1.65;">
      ${personalized}
    </div>
    <p style="text-align:center;color:#54505a;font-size:12px;margin-top:16px;line-height:1.6;">
      Kamu menerima email ini karena memiliki akun Competzy.<br/>
      <a href="${env.APP_URL}" style="color:#5627ff;">arena.competzy.com</a> ·
      <a href="${unsubUrl ?? "mailto:competzy@eduversal.org?subject=Unsubscribe"}" style="color:#54505a;">Berhenti berlangganan</a>
    </p>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Send transports ─────────────────────────────────────────────────────────

function resendApiKey(): string | null {
  // The Resend SMTP password IS an API key — reuse it for the batch REST API.
  return env.SMTP_HOST.includes("resend.com") && env.SMTP_PASS.startsWith("re_")
    ? env.SMTP_PASS
    : null;
}

interface BatchItem {
  recipientRowId: number;
  email: string;
  html: string;
  /** RFC 8058 one-click unsubscribe headers. */
  headers: Record<string, string>;
}

/** Sends one batch. Returns per-row outcomes aligned to `items`. */
async function sendBatch(
  subject: string,
  items: BatchItem[]
): Promise<Array<{ ok: boolean; error?: string }>> {
  const key = resendApiKey();
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify(
          items.map((i) => ({ from: env.SMTP_FROM, to: [i.email], subject, html: i.html, headers: i.headers }))
        ),
      });
      if (res.ok) return items.map(() => ({ ok: true }));
      const text = (await res.text()).slice(0, 300);
      // A whole-batch rejection (bad key, quota) — mark all failed with the reason.
      return items.map(() => ({ ok: false, error: `resend ${res.status}: ${text}` }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network error";
      return items.map(() => ({ ok: false, error: `resend fetch: ${msg}` }));
    }
  }

  // SMTP fallback — sequential, per-recipient outcomes.
  const out: Array<{ ok: boolean; error?: string }> = [];
  for (const i of items) {
    try {
      await sendMailOrThrow({ from: env.SMTP_FROM, to: i.email, subject, html: i.html, headers: i.headers });
      out.push({ ok: true });
    } catch (err) {
      out.push({ ok: false, error: err instanceof Error ? err.message.slice(0, 300) : "send failed" });
    }
  }
  return out;
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

/** Snapshot the audience + flip to `sending`. Returns the recipient count. */
export async function startBroadcast(broadcastId: string): Promise<number> {
  const b = await pool.query(
    `SELECT id, audience, status FROM email_broadcasts WHERE id = $1`,
    [broadcastId]
  );
  if (b.rows.length === 0) throw new Error("Broadcast not found");
  if (b.rows[0].status !== "draft") throw new Error("Broadcast already started");

  const recipients = await resolveAudience(b.rows[0].audience as Audience);
  if (recipients.length === 0) throw new Error("Audience is empty");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Multi-row insert in chunks (parameter limit safety).
    for (let i = 0; i < recipients.length; i += 500) {
      const chunk = recipients.slice(i, i + 500);
      const values: string[] = [];
      const params: unknown[] = [broadcastId];
      chunk.forEach((r, j) => {
        const o = 1 + j * 3;
        values.push(`($1, $${o + 1}, $${o + 2}, $${o + 3})`);
        params.push(r.userId, r.email, r.fullName);
      });
      await client.query(
        `INSERT INTO email_broadcast_recipients (broadcast_id, user_id, email, full_name)
         VALUES ${values.join(",")}`,
        params
      );
    }
    await client.query(
      `UPDATE email_broadcasts
          SET status = 'sending', total_recipients = $2, started_at = now()
        WHERE id = $1`,
      [broadcastId, recipients.length]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return recipients.length;
}

/** One processor tick: drain a batch from the oldest `sending` broadcast. */
export async function processBroadcasts(): Promise<void> {
  const b = await pool.query(
    `SELECT id, subject, html FROM email_broadcasts
      WHERE status = 'sending' ORDER BY started_at ASC LIMIT 1`
  );
  if (b.rows.length === 0) return;
  const { id, subject, html } = b.rows[0];

  const pending = await pool.query(
    `SELECT id, email, full_name FROM email_broadcast_recipients
      WHERE broadcast_id = $1 AND status = 'pending'
      ORDER BY id ASC LIMIT $2`,
    [id, BATCH_SIZE]
  );

  if (pending.rows.length === 0) {
    // Drained — finalize. failed > 0 && sent = 0 → failed, else sent.
    await pool.query(
      `UPDATE email_broadcasts
          SET status = CASE WHEN sent_count = 0 AND failed_count > 0 THEN 'failed' ELSE 'sent' END,
              finished_at = now()
        WHERE id = $1 AND status = 'sending'`,
      [id]
    );
    console.log(`[broadcast] ${id} finished`);
    return;
  }

  const items: BatchItem[] = pending.rows.map((r) => {
    const unsub = unsubscribeUrl(r.email);
    return {
      recipientRowId: r.id,
      email: r.email,
      html: renderBroadcastHtml(html, r.full_name, unsub),
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  });

  const results = await sendBatch(subject, items);

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i++) {
    const r = results[i];
    if (r.ok) {
      sent++;
      await pool.query(
        `UPDATE email_broadcast_recipients SET status = 'sent', sent_at = now() WHERE id = $1`,
        [items[i].recipientRowId]
      );
    } else {
      failed++;
      await pool.query(
        `UPDATE email_broadcast_recipients SET status = 'failed', error = $2 WHERE id = $1`,
        [items[i].recipientRowId, r.error ?? null]
      );
    }
  }
  await pool.query(
    `UPDATE email_broadcasts
        SET sent_count = sent_count + $2, failed_count = failed_count + $3
      WHERE id = $1`,
    [id, sent, failed]
  );
  console.log(`[broadcast] ${id}: +${sent} sent, +${failed} failed`);
}

let timer: NodeJS.Timeout | null = null;

/** Starts the interval processor (idempotent). ~360 emails/min at defaults. */
export function scheduleBroadcastProcessor(): void {
  if (timer) return;
  if (!isSmtpConfigured()) {
    console.warn("[broadcast] SMTP not configured — broadcast processor idle until it is.");
  }
  timer = setInterval(() => {
    processBroadcasts().catch((err) => console.error("[broadcast] tick error:", err));
  }, TICK_MS);
  console.log(`[broadcast] processor scheduled (every ${TICK_MS / 1000}s, batch ${BATCH_SIZE})`);
}
