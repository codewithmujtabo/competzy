import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * OTP send limiter: 5 requests per 15 minutes per IP + identifier.
 * Protects against SMS/email spam that costs money.
 */
export const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { message: "Too many OTP requests. Please wait 15 minutes and try again." },
  keyGenerator: (req) => {
    const identifier = req.body?.email || req.body?.phone || "unknown";
    return `${ipKeyGenerator(req.ip ?? "")}:${identifier}`;
  },
});

/**
 * OTP verify limiter: 10 attempts per hour per IP + identifier.
 * Protects against brute-force OTP guessing.
 */
export const otpVerifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { message: "Too many verification attempts. Please try again in an hour." },
  keyGenerator: (req) => {
    const identifier = req.body?.email || req.body?.phone || "unknown";
    return `${ipKeyGenerator(req.ip ?? "")}:${identifier}`;
  },
});

/**
 * General auth limiter: 20 requests per 15 minutes per IP.
 * Applied to login + signup to slow down credential stuffing.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

/**
 * Bulk upload limiter: 3 uploads per hour per user.
 * Protects against accidental or malicious large CSV floods that strain the cron processor.
 */
export const bulkUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { message: "Too many bulk uploads. Please wait an hour before retrying." },
  keyGenerator: (req) => {
    // Prefer authenticated user ID (set by authMiddleware) for fair limiting per account.
    const userId = (req as any).userId;
    if (userId) return `user:${userId}`;
    return ipKeyGenerator(req.ip ?? "");
  },
});

/**
 * Password reset limiter: 5 requests per 15 minutes per IP + email.
 * Protects against email-bombing the reset endpoint and against brute-forcing
 * the reset token on the verify side.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { message: "Too many password reset requests. Please wait 15 minutes and try again." },
  keyGenerator: (req) => {
    const identifier = req.body?.email || req.body?.token || "unknown";
    return `${ipKeyGenerator(req.ip ?? "")}:${identifier}`;
  },
});

/**
 * PIN verify limiter: 5 attempts per 15 minutes per IP + email.
 * Protects against brute-force PIN guessing for parent invitations.
 */
export const pinVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { message: "Too many PIN verification attempts. Please try again in 15 minutes." },
  keyGenerator: (req) => {
    const identifier = req.body?.email || "unknown";
    return `${ipKeyGenerator(req.ip ?? "")}:${identifier}`;
  },
});
