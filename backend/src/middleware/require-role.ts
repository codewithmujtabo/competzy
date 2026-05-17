import { Request, Response, NextFunction } from "express";

/**
 * Generic role gate. Returns an Express middleware that responds 403 unless the
 * authenticated user's role is one of `roles`. Must run AFTER `authMiddleware`,
 * which populates `req.userRole`.
 *
 *   router.use(authMiddleware, requireRole("admin", "organizer"));
 *
 * The existing per-role middleware (adminOnly, organizerOnly, schoolAdminOnly, …)
 * is intentionally left untouched — this helper is purely additive, for routes
 * that gate on a custom role set rather than a single hardcoded role.
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = (req as any).userRole;
    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({
        message: `Access denied. Requires one of: ${roles.join(", ")}.`,
      });
      return;
    }
    next();
  };
};
