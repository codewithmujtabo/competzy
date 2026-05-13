import { Router, Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import { pool } from "../config/database";
import { env } from "../config/env";
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateOtp,
} from "../services/auth.service";
import { sendOtpEmail, sendPasswordResetEmail } from "../services/email.service";
import { sendPhoneOtp, verifyPhoneOtp, toE164 } from "../services/twilio.service";
import { authMiddleware } from "../middleware/auth";
import {
  otpSendLimiter,
  otpVerifyLimiter,
  authLimiter,
  passwordResetLimiter,
} from "../middleware/rate-limit";

const router = Router();

// ── Auth-cookie helpers ───────────────────────────────────────────────────
// httpOnly + sameSite=lax + secure-in-prod is the OWASP-recommended cookie posture
// for session tokens. The web reads this; the mobile app continues to use the
// Authorization: Bearer header so this cookie has no effect on it.
const COOKIE_NAME = "competzy_token";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches JWT_EXPIRES_IN default

function issueAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   COOKIE_MAX_AGE_MS,
    path:     "/",
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

// ── T13: Auto-link historical records on login ────────────────────────────
// Runs once per user (skips if already linked). Matches on email OR phone.
async function autoLinkHistoricalRecords(userId: string, email: string | null, phone: string | null): Promise<void> {
  try {
    const existing = await pool.query(
      "SELECT id FROM historical_participants WHERE claimed_by = $1 LIMIT 1",
      [userId]
    );
    if (existing.rows.length > 0) return; // already linked

    const conditions: string[] = [];
    const params: unknown[] = [userId];
    let idx = 2;

    if (email) { conditions.push(`email = $${idx++}`); params.push(email.toLowerCase()); }
    if (phone) { conditions.push(`phone = $${idx++}`); params.push(phone); }
    if (conditions.length === 0) return;

    const result = await pool.query(
      `UPDATE historical_participants
       SET claimed_by = $1, claimed_at = now()
       WHERE claimed_by IS NULL AND (${conditions.join(" OR ")})`,
      params
    );
    if ((result.rowCount ?? 0) > 0) {
      console.log(`[historical] Auto-linked ${result.rowCount} records for user ${userId}`);
    }
  } catch (err) {
    console.error("[historical] Auto-link error:", err);
  }
}

// ── Helper: fetch user + role data ────────────────────────────────────────
async function fetchUserWithRole(userId: string) {
  const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  if (userResult.rows.length === 0) return null;

  const user = userResult.rows[0];
  let roleData = {};

  if (user.role === "student") {
    const r = await pool.query("SELECT * FROM students WHERE id = $1", [userId]);
    if (r.rows.length > 0) {
      const s = r.rows[0];
      roleData = { school: s.school_name, grade: s.grade, nisn: s.nisn };
    }
  } else if (user.role === "parent") {
    const r = await pool.query("SELECT * FROM parents WHERE id = $1", [userId]);
    if (r.rows.length > 0) {
      const p = r.rows[0];
      roleData = {
        childName: p.child_name,
        childSchool: p.child_school,
        childGrade: p.child_grade,
        relationship: p.relationship,
      };
    }
  } else if (user.role === "teacher") {
    const r = await pool.query("SELECT * FROM teachers WHERE id = $1", [userId]);
    if (r.rows.length > 0) {
      const t = r.rows[0];
      roleData = { school: t.school, subject: t.subject, department: t.department };
    }
  } else if (user.role === "school_admin") {
    // Fetch school info for school_admin
    const r = await pool.query(
      "SELECT s.* FROM schools s JOIN users u ON u.school_id = s.id WHERE u.id = $1",
      [userId]
    );
    if (r.rows.length > 0) {
      const school = r.rows[0];
      roleData = {
        school: school.name,
        npsn: school.npsn,
        schoolCity: school.city,
        schoolProvince: school.province,
        schoolId: school.id,
        schoolVerificationStatus: school.verification_status,   // pending_verification | verified | rejected
        schoolRejectionReason: school.rejection_reason ?? null,
      };
    }
  }

  return {
    id: user.id,
    kid: user.kid,            // KX-2026-NNNNNNN — stable person identifier (Spec F-ID-02)
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    city: user.city,
    role: user.role,
    photoUrl: user.photo_url,
    createdAt: user.created_at,
    ...roleData,
  };
}

// ── POST /api/auth/signup ─────────────────────────────────────────────────
router.post("/signup", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, phone, city, province, role, roleData, consentAccepted } = req.body;

    if (!email || !password || !fullName || !role) {
      res.status(400).json({ message: "email, password, fullName, and role are required" });
      return;
    }

    if (!consentAccepted) {
      res.status(400).json({ message: "You must accept the privacy policy to create an account" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }

    // Check if email already exists
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    const passwordHash = await hashPassword(password);

    // Use a transaction for atomicity
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, full_name, phone, city, province, role, consent_accepted_at, consent_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
         RETURNING id`,
        [email, passwordHash, fullName, phone || null, city || null, province || null, role, "1.0"]
      );
      const userId = userResult.rows[0].id;

      // Insert into role-specific table
      if (role === "student") {
        await client.query(
          "INSERT INTO students (id, school_name, grade, npsn, school_address) VALUES ($1, $2, $3, $4, $5)",
          [userId, roleData?.school || null, roleData?.grade || null, roleData?.npsn || null, roleData?.schoolAddress || null]
        );
      } else if (role === "parent") {
        await client.query(
          "INSERT INTO parents (id, child_name, child_school, child_grade) VALUES ($1, $2, $3, $4)",
          [userId, roleData?.childName || null, roleData?.childSchool || null, roleData?.childGrade || null]
        );
      } else if (role === "teacher") {
        await client.query(
          "INSERT INTO teachers (id, school, subject) VALUES ($1, $2, $3)",
          [userId, roleData?.school || null, roleData?.subject || null]
        );
      }

      await client.query("COMMIT");

      const token = generateToken(userId);
      const user = await fetchUserWithRole(userId);
      issueAuthCookie(res, token);
      res.status(201).json({ token, user });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Failed to create account" });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const dbUser = result.rows[0];
    const valid = await comparePassword(password, dbUser.password_hash);
    if (!valid) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = generateToken(dbUser.id);
    const user = await fetchUserWithRole(dbUser.id);
    issueAuthCookie(res, token);
    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// ── POST /api/auth/send-otp ──────────────────────────────────────────────
router.post("/send-otp", otpSendLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

    await pool.query(
      "INSERT INTO otp_codes (email, code, expires_at) VALUES ($1, $2, $3)",
      [email, code, expiresAt]
    );

    await sendOtpEmail(email, code);
    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

// ── POST /api/auth/verify-otp ────────────────────────────────────────────
router.post("/verify-otp", otpVerifyLimiter, async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      res.status(400).json({ message: "Email and code are required" });
      return;
    }

    // Find valid OTP
    const otpResult = await pool.query(
      `SELECT id FROM otp_codes
       WHERE email = $1 AND code = $2 AND used = false AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );

    if (otpResult.rows.length === 0) {
      res.status(400).json({ message: "Invalid or expired OTP" });
      return;
    }

    // Mark OTP as used
    await pool.query("UPDATE otp_codes SET used = true WHERE id = $1", [otpResult.rows[0].id]);

    // Find or error — user must exist (OTP login only for existing users)
    const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ message: "No account found with this email. Please sign up first." });
      return;
    }

    const userId = userResult.rows[0].id;
    const token = generateToken(userId);
    const user = await fetchUserWithRole(userId);
    issueAuthCookie(res, token);
    res.json({ token, user });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ message: "OTP verification failed" });
  }
});

// ── POST /api/auth/phone/send-otp ────────────────────────────────────────
router.post("/phone/send-otp", otpSendLimiter, async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ message: "phone is required" });
      return;
    }
    await sendPhoneOtp(phone);
    res.json({ message: "OTP sent via SMS" });
  } catch (err: any) {
    console.error("Phone send-otp error:", err);
    res.status(500).json({ message: err.message || "Failed to send OTP" });
  }
});

// ── POST /api/auth/phone/verify-otp ──────────────────────────────────────
router.post("/phone/verify-otp", otpVerifyLimiter, async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      res.status(400).json({ message: "phone and code are required" });
      return;
    }

    const approved = await verifyPhoneOtp(phone, code);
    if (!approved) {
      res.status(400).json({ message: "Invalid or expired OTP" });
      return;
    }

    const e164 = toE164(phone);

    // Find existing user by phone
    const result = await pool.query(
      "SELECT id FROM users WHERE phone = $1 OR phone = $2",
      [phone, e164]
    );

    if (result.rows.length === 0) {
      // Check historical_participants — if this phone was in a past competition, pre-fill signup
      const histResult = await pool.query(
        `SELECT full_name, email FROM historical_participants WHERE phone = $1 LIMIT 1`,
        [e164]
      );
      if (histResult.rows.length > 0) {
        const { full_name, email } = histResult.rows[0];
        res.json({ historicalMatch: true, fullName: full_name, email: email ?? "", phone: e164 });
        return;
      }
      // No account and no historical match
      res.status(404).json({ message: "NO_ACCOUNT", phone: e164 });
      return;
    }

    const userId = result.rows[0].id;

    // Mark phone as verified
    await pool.query(
      "UPDATE users SET phone_verified_at = now() WHERE id = $1",
      [userId]
    );

    const token = generateToken(userId);
    const user = await fetchUserWithRole(userId);
    // T13: Auto-link historical records on phone login
    autoLinkHistoricalRecords(userId, user?.email ?? null, e164);
    issueAuthCookie(res, token);
    res.json({ token, user });
  } catch (err: any) {
    console.error("Phone verify-otp error:", err);
    res.status(500).json({ message: err.message || "OTP verification failed" });
  }
});

// ── POST /api/auth/forgot-password ────────────────────────────────────────
// Email-based password reset. We NEVER tell the caller whether the email
// matched an account — always 200 — so the endpoint can't be used as an
// account-enumeration oracle. The raw token only exists in the response
// email; the DB stores its SHA-256 hash with a 15-minute TTL.
const RESET_TOKEN_TTL_MIN = 15;

function appBaseUrl(req: Request): string {
  // Prefer the request's Origin header (matches whichever subdomain the
  // user is on); fall back to the configured APP_URL for server-to-server
  // calls or missing headers.
  const origin = (req.headers.origin as string | undefined)?.trim();
  if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, "");
  return env.APP_URL.replace(/\/$/, "");
}

router.post("/forgot-password", passwordResetLimiter, async (req: Request, res: Response) => {
  try {
    const email = (req.body?.email as string | undefined)?.trim().toLowerCase();
    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    const userResult = await pool.query(
      "SELECT id, full_name FROM users WHERE LOWER(email) = $1 AND deleted_at IS NULL",
      [email],
    );

    if (userResult.rows.length > 0) {
      const { id: userId, full_name: fullName } = userResult.rows[0];
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000);

      await pool.query(
        "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        [userId, tokenHash, expiresAt],
      );

      const resetUrl = `${appBaseUrl(req)}/reset-password?token=${token}`;
      try {
        await sendPasswordResetEmail(email, resetUrl, fullName);
      } catch (mailErr) {
        // Log but keep returning 200 so we don't reveal whether the email exists.
        console.error("Password reset email send failed:", mailErr);
      }
    }

    res.json({
      message: "If an account exists with that email, we've sent a reset link. Check your inbox.",
    });
  } catch (err) {
    console.error("Forgot-password error:", err);
    res.status(500).json({ message: "Could not process request" });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────
// Consumes a token from the email link, sets a new password, and marks the
// token used. Single use; expired or already-used tokens fail with a generic
// message that doesn't distinguish the two cases.
router.post("/reset-password", passwordResetLimiter, async (req: Request, res: Response) => {
  try {
    const token = (req.body?.token as string | undefined)?.trim();
    const password = req.body?.password as string | undefined;

    if (!token || !password) {
      res.status(400).json({ message: "Token and password are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ message: "Password must be at least 8 characters" });
      return;
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const tokenResult = await pool.query(
      `SELECT id, user_id
         FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        LIMIT 1`,
      [tokenHash],
    );

    if (tokenResult.rows.length === 0) {
      res.status(400).json({ message: "Reset link is invalid or has expired. Request a new one." });
      return;
    }

    const { id: tokenId, user_id: userId } = tokenResult.rows[0];
    const passwordHash = await hashPassword(password);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
      await client.query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [tokenId]);
      // Invalidate every other outstanding reset token for this user — the
      // simplest way to ensure one successful reset disables all stragglers.
      await client.query(
        "UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL",
        [userId],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.json({ message: "Password updated. You can now sign in with the new password." });
  } catch (err) {
    console.error("Reset-password error:", err);
    res.status(500).json({ message: "Could not reset password" });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────
// Clears the httpOnly auth cookie (web). Mobile clients can simply discard
// their stored token; this endpoint is a no-op for them but always 200s.
router.post("/logout", (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ message: "Logged out" });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await fetchUserWithRole(req.userId!);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    // T13: Fire-and-forget auto-link — does not block the response
    autoLinkHistoricalRecords(req.userId!, user.email ?? null, user.phone ?? null);
    res.json(user);
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

export default router;
