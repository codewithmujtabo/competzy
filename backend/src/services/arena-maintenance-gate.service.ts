import { Request, Response } from "express";
import { getMaintenanceMode } from "../routes/maintenance.routes";
import { requestHasValidBypass } from "./bypass-cookie.service";
import { isSuperAdminEmail } from "./auth.service";

// ─────────────────────────────────────────────────────────────────────────
// Auth-side gate for arena's own maintenance toggle.
//
// When admin sets `arena.competzy.com` to read-only or on, the auth
// write endpoints (login, signup, OTP verify) MUST refuse new
// authentications — otherwise students/parents can still sign up or
// sign in despite the maintenance flag, defeating the purpose.
//
// Existing sessions (anyone holding a current JWT cookie) keep working
// — only the FRESH auth attempt is blocked.
//
// Mode → behavior:
//   off        → pass through (normal)
//   read-only  → block, 503 ARENA_READONLY (login + signup + OTP verify)
//   on         → block, 503 ARENA_MAINTENANCE
//
// Lockout defenses (any ONE is enough to let an admin in):
//   1. Bypass cookie present + valid           → checked BEFORE creds
//      (handled by `gateArenaAuth(req, res)`).
//   2. Identified caller is admin/superadmin   → checked AFTER creds are
//      verified by the route, via `enforceArenaAuthGate(req, res, email, role)`.
//      A login route's flow: verify password → identify user → call this
//      → on admin pass through; on non-admin block. This is what stops a
//      cookie-less admin from being locked out of their own kill switch.
// ─────────────────────────────────────────────────────────────────────────

const ARENA_HOST = "arena.competzy.com";

function buildBlockedResponse(mode: "read-only" | "on"): {
  status: number;
  body: Record<string, unknown>;
} {
  if (mode === "on") {
    return {
      status: 503,
      body: {
        code: "ARENA_MAINTENANCE",
        mode,
        message: "Arena is offline for maintenance. Please try again later.",
      },
    };
  }
  return {
    status: 503,
    body: {
      code: "ARENA_READONLY",
      mode,
      message: "New sign-ins and sign-ups are temporarily paused.",
    },
  };
}

/**
 * PRE-CREDENTIAL check — called from signup and at the top of OTP/login
 * paths to short-circuit obviously gated requests early. Bypass is via
 * cookie only here, since we haven't identified the caller yet.
 *
 * Returns null = pass through. Object = caller should send that response.
 *
 * Fails OPEN on any DB error.
 */
export async function checkArenaAuthGate(
  req: Request,
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  try {
    const mode = await getMaintenanceMode(ARENA_HOST);
    if (mode === "off") return null;

    // Bypass cookie issued by a previous admin login. Lets them in
    // immediately without a password round-trip.
    if (requestHasValidBypass(req)) return null;

    return buildBlockedResponse(mode);
  } catch (err) {
    console.error("[arena-maintenance-gate] lookup failed:", err);
    return null;
  }
}

/**
 * Convenience around {@link checkArenaAuthGate} — sends the response.
 * Returns true = response sent, route should `return`. False = continue.
 *
 * Use this on SIGNUP only (no identity yet). For login + OTP verify, use
 * {@link enforceArenaAuthGate} AFTER the credential check so admins can
 * always sign in.
 */
export async function gateArenaAuth(req: Request, res: Response): Promise<boolean> {
  const gated = await checkArenaAuthGate(req);
  if (!gated) return false;
  res.status(gated.status).json(gated.body);
  return true;
}

/**
 * POST-CREDENTIAL check — called from login + OTP verify AFTER the
 * password/OTP is confirmed and the caller's identity is known. Admins
 * pass through regardless of maintenance mode so they can never lock
 * themselves out of their own kill switch; everyone else gets blocked.
 *
 * Returns true = response sent (caller blocked), route should `return`.
 * False = continue (issue token + session).
 *
 * Role check happens BEFORE the cookie check because role identity is
 * authoritative once creds are verified — the cookie is just a
 * convenience shortcut.
 */
export async function enforceArenaAuthGate(
  req: Request,
  res: Response,
  callerEmail: string | null | undefined,
  callerRole: string | null | undefined,
): Promise<boolean> {
  try {
    const mode = await getMaintenanceMode(ARENA_HOST);
    if (mode === "off") return false;

    // Authenticated identity wins. Admin / superadmin sail through.
    if (callerRole === "admin" || isSuperAdminEmail(callerEmail)) return false;

    // Same convenience — already-bypassed admin doesn't hit this either.
    if (requestHasValidBypass(req)) return false;

    const blocked = buildBlockedResponse(mode);
    res.status(blocked.status).json(blocked.body);
    return true;
  } catch (err) {
    // Fail OPEN — never let a DB hiccup lock the auth path out.
    console.error("[arena-maintenance-gate] enforce lookup failed:", err);
    return false;
  }
}
