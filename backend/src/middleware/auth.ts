import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.service";
import { pool } from "../config/database";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
      // Set when this session is an impersonation — the super-admin's id.
      impersonatorId?: string;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Token can come from either:
  //   • Authorization: Bearer <jwt> header (mobile app via SecureStore)
  //   • competzy_token httpOnly cookie (web — set on login, sent automatically)
  // The Bearer header wins if both are present, so a mobile request never falls back to a stale cookie.
  let token: string | null = null;
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    token = header.slice(7);
  } else if ((req as any).cookies?.competzy_token) {
    token = (req as any).cookies.competzy_token;
  }

  if (!token) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  req.userId = payload.sub;
  // An impersonation token carries `imp` — the super-admin who started it.
  req.impersonatorId = payload.imp;

  // Fetch user role for authorization, rejecting soft-deleted users (UU PDP / account-deleted protection).
  try {
    const result = await pool.query(
      "SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL",
      [payload.sub]
    );
    if (result.rows.length === 0) {
      // Either user never existed or has been soft-deleted: refuse auth.
      res.status(401).json({ message: "Account is no longer active" });
      return;
    }
    req.userRole = result.rows[0].role;
  } catch (err) {
    console.error("Error fetching user role:", err);
    res.status(500).json({ message: "Auth lookup failed" });
    return;
  }

  next();
}
