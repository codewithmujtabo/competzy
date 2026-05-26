import { Request, Response } from "express";
import { getMaintenanceMode } from "../routes/maintenance.routes";
import { requestHasValidBypass } from "./bypass-cookie.service";

// ─────────────────────────────────────────────────────────────────────────
// Auth-side gate for arena's own maintenance toggle.
//
// When admin sets `arena.competzy.com` to read-only or on, the auth
// write endpoints (login, signup, OTP verify) MUST refuse new
// authentications — otherwise students/parents can still sign up or
// sign in despite the maintenance flag, defeating the purpose.
//
// Existing sessions (admins already holding a JWT cookie, OR anyone
// with a valid bypass cookie) keep working — only the FRESH auth
// attempt is blocked. This is the "form submissions disabled, page
// still visible" semantic from the spec (section 5).
//
// Mode → behavior:
//   off        → pass through (normal)
//   read-only  → block, 503 ARENA_READONLY (login + signup + OTP verify)
//   on         → block, 503 ARENA_MAINTENANCE
//
// Bypass: admin/superadmin cookie holders skip the gate at every mode.
// They need to be able to log in to flip the toggle off if they
// somehow lost their JWT.
// ─────────────────────────────────────────────────────────────────────────

const ARENA_HOST = "arena.competzy.com";

/**
 * Returns null when the request should be allowed through; otherwise
 * returns a `{ status, body }` object the route should send back.
 *
 * Route usage:
 *
 *   const gated = await checkArenaAuthGate(req);
 *   if (gated) { res.status(gated.status).json(gated.body); return; }
 *
 * Fails OPEN — any error in the lookup resolves to "allow", so a
 * misconfigured DB or stale cache can never lock the auth path out
 * entirely.
 */
export async function checkArenaAuthGate(
  req: Request,
): Promise<{ status: number; body: Record<string, unknown> } | null> {
  try {
    const mode = await getMaintenanceMode(ARENA_HOST);
    if (mode === "off") return null;

    // Admin/superadmin holding a valid bypass cookie bypasses the
    // gate — they may need to sign in to flip the toggle off.
    if (requestHasValidBypass(req)) return null;

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
    // read-only — softer copy
    return {
      status: 503,
      body: {
        code: "ARENA_READONLY",
        mode,
        message: "Arena is in read-only mode. New sign-ins and sign-ups are temporarily paused.",
      },
    };
  } catch (err) {
    console.error("[arena-maintenance-gate] lookup failed:", err);
    return null;
  }
}

/**
 * Convenience: send the gated response in one call. Returns true when
 * the route should stop (response already sent), false when it should
 * continue.
 */
export async function gateArenaAuth(req: Request, res: Response): Promise<boolean> {
  const gated = await checkArenaAuthGate(req);
  if (!gated) return false;
  res.status(gated.status).json(gated.body);
  return true;
}
