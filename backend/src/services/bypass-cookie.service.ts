import { Response, CookieOptions } from "express";
import crypto from "crypto";
import { env } from "../config/env";

// ─────────────────────────────────────────────────────────────────────────
// Admin bypass cookie — `competzy_bypass`
//
// Shared with competzy-web so admin/superadmin visitors can bypass the
// maintenance takeover page on competzy.com + every subdomain. Contract
// lives at competzy-web/docs/arena-maintenance-spec.md section 2.
//
// Encoding: <base64url(payload_json)>.<base64url(hmac_sha256(payload, secret))>
// Cookie:   Domain=.competzy.com (prod) HttpOnly Secure SameSite=Lax
// Validity: 7 days (matches the auth cookie TTL).
//
// The signing secret MUST match competzy-web's BYPASS_COOKIE_SECRET env var.
// If env.BYPASS_COOKIE_SECRET is empty, issuance and clearing are no-ops —
// the maintenance system simply can't be bypassed (which is correct
// behavior for a misconfigured deploy: fail closed for admins, fail open
// for the public via competzy-web's middleware).
// ─────────────────────────────────────────────────────────────────────────

const COOKIE_NAME = "competzy_bypass";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BypassPayload {
  role: "admin" | "superadmin";
  exp: number; // unix seconds
  iat: number; // unix seconds
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payloadB64: string, secret: string): string {
  return b64urlEncode(
    crypto.createHmac("sha256", secret).update(payloadB64).digest(),
  );
}

/**
 * Build the signed bypass token. Returned as `<payload>.<signature>`.
 * Exported for tests + smoke scripts; routes go through {@link issueBypassCookie}.
 */
export function buildBypassToken(role: "admin" | "superadmin"): string | null {
  const secret = env.BYPASS_COOKIE_SECRET;
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload: BypassPayload = {
    role,
    iat: now,
    exp: now + Math.floor(COOKIE_MAX_AGE_MS / 1000),
  };
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

/**
 * Set the bypass cookie on `res`. Call on admin/superadmin login. Silently
 * does nothing if `BYPASS_COOKIE_SECRET` isn't configured.
 *
 * Domain handling: in prod we use `.competzy.com` so every subdomain sees
 * the cookie. Locally there's no shared parent domain (`localhost` doesn't
 * count as a domain by RFC 6265), so we omit `domain` and the cookie scopes
 * to `arena.competzy.com` — equivalent behaviour at the test host because
 * dev only ever runs one subdomain anyway.
 */
export function issueBypassCookie(
  res: Response,
  role: "admin" | "superadmin",
): void {
  const token = buildBypassToken(role);
  if (!token) return;

  const opts: CookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  };
  // Only set Domain in prod — `Secure` is required when Domain is shared
  // across subdomains, which won't work over plain http://localhost.
  if (env.BYPASS_COOKIE_DOMAIN && env.NODE_ENV === "production") {
    opts.domain = env.BYPASS_COOKIE_DOMAIN;
  }
  res.cookie(COOKIE_NAME, token, opts);
}

/**
 * Clear the bypass cookie. Call on logout. Must mirror the Domain used at
 * issuance — a `clearCookie` without the same `domain` won't actually clear
 * the .competzy.com-scoped cookie in browsers.
 */
export function clearBypassCookie(res: Response): void {
  const opts: CookieOptions = { path: "/" };
  if (env.BYPASS_COOKIE_DOMAIN && env.NODE_ENV === "production") {
    opts.domain = env.BYPASS_COOKIE_DOMAIN;
  }
  res.clearCookie(COOKIE_NAME, opts);
}
