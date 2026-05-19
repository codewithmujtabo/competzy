import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Sign a session token. A plain login passes only `userId`. An impersonation
 * session also passes `opts.impersonatorId` — the super-admin acting as
 * `userId` — which is embedded as the `imp` claim and given a short 1h TTL.
 */
export function generateToken(
  userId: string,
  opts?: { impersonatorId?: string },
): string {
  const payload: Record<string, unknown> = { sub: userId };
  if (opts?.impersonatorId) payload.imp = opts.impersonatorId;
  return jwt.sign(payload, env.JWT_SECRET, {
    // Impersonation sessions are deliberately short-lived; a normal login uses
    // the configured TTL.
    expiresIn: (opts?.impersonatorId ? "1h" : env.JWT_EXPIRES_IN) as string,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): { sub: string; imp?: string } | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as { sub: string; imp?: string };
  } catch {
    return null;
  }
}

/** True when `email` is the configured super-admin (case-insensitive). */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === env.SUPER_ADMIN_EMAIL;
}

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}
