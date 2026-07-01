import { Router, Request, Response } from "express";
import { env } from "../config/env";
import { suppressEmail, verifyUnsubscribeToken } from "../services/broadcast.service";

// ── /api/email — PUBLIC unsubscribe endpoints (no auth by design) ──────────
// The token is an HMAC over the recipient email, so only someone holding a
// real broadcast email can unsubscribe that address. Two entry points:
//   POST — RFC 8058 one-click (mail clients hit the List-Unsubscribe URL)
//   GET  — the human footer link; suppress + redirect to the arena page.

const router: Router = Router();

function tokenFrom(req: Request): string {
  const q = req.query.token;
  if (typeof q === "string" && q) return q;
  const b = (req.body ?? {}) as Record<string, unknown>;
  return typeof b.token === "string" ? b.token : "";
}

router.post("/unsubscribe", async (req: Request, res: Response) => {
  const email = verifyUnsubscribeToken(tokenFrom(req));
  if (!email) {
    res.status(400).json({ message: "Invalid unsubscribe token" });
    return;
  }
  try {
    await suppressEmail(email, "one-click");
    res.json({ message: "Unsubscribed" });
  } catch (err) {
    console.error("unsubscribe error:", err);
    res.status(500).json({ message: "Failed to unsubscribe" });
  }
});

router.get("/unsubscribe", async (req: Request, res: Response) => {
  const email = verifyUnsubscribeToken(tokenFrom(req));
  if (!email) {
    res.redirect(302, `${env.APP_URL}/unsubscribe?error=1`);
    return;
  }
  try {
    await suppressEmail(email, "link");
    res.redirect(302, `${env.APP_URL}/unsubscribe?done=1`);
  } catch (err) {
    console.error("unsubscribe error:", err);
    res.redirect(302, `${env.APP_URL}/unsubscribe?error=1`);
  }
});

export default router;
