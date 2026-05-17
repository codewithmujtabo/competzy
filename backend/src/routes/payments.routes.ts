import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import { env } from "../config/env";
import { authMiddleware } from "../middleware/auth";
import { schoolAdminOnly } from "../middleware/school-admin.middleware";
import { createSnapToken, getTransactionStatus } from "../services/midtrans.service";
import * as pushService from "../services/push.service";

const router = Router();

// ── T20: Parent ownership check ───────────────────────────────────────────────
// Returns true if userId owns the registration directly OR is a linked parent.
async function canAccessRegistration(userId: string, registrationId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM registrations r
     WHERE r.id = $1
       AND (
         r.user_id = $2
         OR EXISTS (
           SELECT 1 FROM parent_student_links psl
           WHERE psl.parent_id = $2
             AND psl.student_id = r.user_id
             AND psl.status = 'active'
         )
       )
     LIMIT 1`,
    [registrationId, userId]
  );
  return result.rows.length > 0;
}

// ── Wave 9: registration-fee voucher helpers ──────────────────────────────
// A voucher_group is a batch of discount codes; voucher_groups.discounted is
// the absolute fee a voucher-holder pays. Voucher npsn (when set) locks the
// code to one school — matched against the registrant's school NPSN.

interface RegContext {
  compId: string;
  fee: number;
  studentNpsn: string | null;
}

async function loadRegContext(registrationId: string): Promise<RegContext | null> {
  // students.id == users.id (1:1); students.npsn is the NPSN the student
  // registered with — what a school-locked voucher is matched against.
  const r = await pool.query(
    `SELECT r.comp_id, c.fee, s.npsn AS student_npsn
       FROM registrations r
       JOIN competitions c ON c.id = r.comp_id
       LEFT JOIN students s ON s.id = r.user_id
      WHERE r.id = $1`,
    [registrationId]
  );
  if (r.rows.length === 0) return null;
  return {
    compId: r.rows[0].comp_id,
    fee: Number(r.rows[0].fee) || 0,
    studentNpsn: r.rows[0].student_npsn ?? null,
  };
}

interface VoucherCheck {
  valid: boolean;
  message?: string;
  discountedFee?: number;
}

async function checkVoucher(
  compId: string,
  code: string,
  studentNpsn: string | null
): Promise<VoucherCheck> {
  const r = await pool.query(
    `SELECT v.npsn, v.used, v.max, vg.discounted, vg.is_active
       FROM vouchers v
       JOIN voucher_groups vg ON vg.id = v.group_id
      WHERE v.comp_id = $1 AND v.code = $2
        AND v.deleted_at IS NULL AND vg.deleted_at IS NULL
      LIMIT 1`,
    [compId, code]
  );
  if (r.rows.length === 0) {
    return { valid: false, message: "Voucher code not found for this competition." };
  }
  const v = r.rows[0];
  if (!v.is_active) {
    return { valid: false, message: "This voucher batch is no longer active." };
  }
  if (v.used >= v.max) {
    return { valid: false, message: "This voucher code has already been used." };
  }
  if (v.npsn && v.npsn !== studentNpsn) {
    return { valid: false, message: "This voucher is reserved for a different school." };
  }
  return { valid: true, discountedFee: Number(v.discounted) || 0 };
}

// Idempotent redemption — links the voucher to the settling payment and bumps
// `used`. The `payment_id IS NULL` guard makes a webhook+verify double-fire safe.
async function redeemVoucher(compId: string, code: string, paymentDbId: string): Promise<void> {
  await pool.query(
    `UPDATE vouchers
        SET used = used + 1, payment_id = $1, updated_at = now()
      WHERE comp_id = $2 AND code = $3
        AND payment_id IS NULL AND used < max AND deleted_at IS NULL`,
    [paymentDbId, compId, code]
  );
}

// Wave 10: credit a referral for a paid registration. Called only on the
// first pending_review transition (the caller's conditional UPDATE guards
// idempotency) — bumps `paid` + accrues `commission_per_paid` into the total.
async function creditReferralPaid(compId: string, rawCode: string): Promise<void> {
  await pool.query(
    `UPDATE referrals
        SET paid = paid + 1,
            commission = commission + commission_per_paid,
            total = commission + commission_per_paid + bonus,
            updated_at = now()
      WHERE comp_id = $1 AND code = $2 AND deleted_at IS NULL`,
    [compId, rawCode.toUpperCase().trim()]
  );
}

// ── POST /api/payments/webhook ────────────────────────────────────────────────
// Midtrans calls this directly — no auth middleware.
// https://docs.midtrans.com/reference/handling-notifications
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const {
      order_id,
      status_code,
      gross_amount,
      transaction_id,
      transaction_status,
      payment_type,
      fraud_status,
      signature_key,
    } = req.body;

    // ── Signature verification ─────────────────────────────────────────────
    const expectedSig = crypto
      .createHash("sha512")
      .update(`${order_id}${status_code}${gross_amount}${env.MIDTRANS_SERVER_KEY}`)
      .digest("hex");

    if (expectedSig !== signature_key) {
      console.warn("Midtrans webhook: invalid signature for order", order_id);
      res.status(403).json({ message: "Invalid signature" });
      return;
    }

    // ── Idempotency: dedupe by (provider, order_id, signature_key) ─────────
    // Midtrans retries on non-2xx and can also fire duplicate events; without
    // this check we double-process settlements/expiries and corrupt state.
    const dedup = await pool.query(
      `INSERT INTO payment_webhook_events
         (provider, order_id, signature_key, transaction_status, raw_payload)
       VALUES ('midtrans', $1, $2, $3, $4)
       ON CONFLICT (provider, order_id, signature_key) DO NOTHING
       RETURNING id`,
      [order_id, signature_key, transaction_status ?? null, req.body]
    );
    if (dedup.rows.length === 0) {
      console.log(`Midtrans webhook: duplicate event ignored (order=${order_id} status=${transaction_status})`);
      res.json({ message: "OK (duplicate)" });
      return;
    }

    // ── Look up the payment record ─────────────────────────────────────────
    const paymentResult = await pool.query(
      `SELECT p.id, p.kind, p.registration_id, r.comp_id, r.voucher_code,
              r.referral_code, o.id AS order_db_id
         FROM payments p
         LEFT JOIN registrations r ON r.id = p.registration_id
         LEFT JOIN orders o ON o.payment_id = p.id
        WHERE p.order_id = $1 LIMIT 1`,
      [order_id]
    );

    if (paymentResult.rows.length === 0) {
      // Might arrive before the INSERT completes on slow networks — log and 200
      console.warn("Midtrans webhook: no payment found for order_id", order_id);
      res.json({ message: "OK" });
      return;
    }

    const {
      id: paymentDbId,
      kind: paymentKind,
      registration_id,
      comp_id,
      voucher_code,
      referral_code,
      order_db_id,
    } = paymentResult.rows[0];

    // ── Determine new statuses ─────────────────────────────────────────────
    // settlement = non-card success; capture + accept = card success
    const isSuccess =
      transaction_status === "settlement" ||
      (transaction_status === "capture" && fraud_status === "accept");

    let newPaymentStatus: string;

    if (isSuccess) {
      newPaymentStatus = "settlement";
    } else if (transaction_status === "pending") {
      newPaymentStatus = "pending";
    } else if (["deny", "cancel", "expire", "failure"].includes(transaction_status)) {
      newPaymentStatus = transaction_status;
    } else {
      newPaymentStatus = transaction_status ?? "unknown";
    }

    // ── Update payments row ────────────────────────────────────────────────
    await pool.query(
      `UPDATE payments
         SET payment_status = $1,
             payment_id     = $2,
             payment_method = $3,
             updated_at     = now()
       WHERE id = $4`,
      [newPaymentStatus, transaction_id ?? null, payment_type ?? null, paymentDbId]
    );

    // ── Order-kind payment (Wave 9) — settle the merchandise order ─────────
    if (paymentKind === "order") {
      if (isSuccess && order_db_id) {
        await pool.query(
          `UPDATE orders SET status = 'paid', paid_at = now(), updated_at = now()
            WHERE id = $1 AND status = 'ordered'`,
          [order_db_id]
        );
        console.log(`Order payment settled: order=${order_id} → orders.${order_db_id} paid`);
      }
      // On expire/deny/cancel the order stays 'ordered' and is re-payable —
      // the pay endpoint will mint a fresh Snap token.
      console.log(
        `Payment webhook: order=${order_id} kind=order status=${newPaymentStatus}`
      );
      res.json({ message: "OK" });
      return;
    }

    // ── Registration-kind payment ──────────────────────────────────────────
    // T10: VA/payment expired — reset so student can try paying again
    if (transaction_status === "expire") {
      await pool.query(
        `UPDATE registrations SET status = 'pending_payment', updated_at = now() WHERE id = $1`,
        [registration_id]
      );
      console.log(`Payment expired: order=${order_id} — registration ${registration_id} reset to 'pending_payment'`);
    }

    // ── Payment settled — move to pending_review (awaiting admin approval) ──
    // The UPDATE is conditional + RETURNING so a webhook+verify double-settle
    // credits the voucher / referral exactly once (the row only flips once).
    if (isSuccess) {
      const settled = await pool.query(
        `UPDATE registrations SET status = 'pending_review', updated_at = now()
          WHERE id = $1
            AND status NOT IN ('pending_review','approved','paid','completed')
        RETURNING id`,
        [registration_id]
      );
      const firstSettle = (settled.rowCount ?? 0) > 0;

      // Redeem the registration-fee voucher + credit the referral, if any.
      if (firstSettle && voucher_code && comp_id) {
        await redeemVoucher(comp_id, voucher_code, paymentDbId);
      }
      if (firstSettle && referral_code && comp_id) {
        await creditReferralPaid(comp_id, referral_code);
      }

      const regResult = await pool.query(
        `SELECT r.user_id, r.comp_id, c.name as comp_name
         FROM registrations r
         JOIN competitions c ON c.id = r.comp_id
         WHERE r.id = $1`,
        [registration_id]
      );

      if (regResult.rows.length > 0) {
        const { user_id, comp_id, comp_name } = regResult.rows[0];

        await pushService.sendPushNotification(
          user_id,
          "Payment Confirmed!",
          `Payment for ${comp_name} received! Your application is now under admin review.`,
          {
            type: "payment_success",
            compId: comp_id,
            registrationId: registration_id,
          }
        );
      }
    }

    console.log(
      `Payment webhook: order=${order_id} status=${newPaymentStatus} reg=${registration_id}`
    );
    res.json({ message: "OK" });
  } catch (err: any) {
    console.error("Payment webhook error:", err);
    res.status(500).json({ message: "Internal error" });
  }
});

// All routes below require auth ───────────────────────────────────────────────
router.use(authMiddleware);

// ── POST /api/payments/snap ───────────────────────────────────────────────────
router.post("/snap", async (req: Request, res: Response) => {
  try {
    const { registrationId, payerKind, payerUserId, voucherCode } = req.body as {
      registrationId?: string;
      payerKind?: "self" | "parent" | "school" | "sponsor";
      payerUserId?: string;
      voucherCode?: string;
    };

    if (!registrationId) {
      res.status(400).json({ message: "registrationId is required" });
      return;
    }

    // Whitelist payer kinds. Default to "self".
    const resolvedPayerKind: "self" | "parent" | "school" | "sponsor" =
      payerKind && ["self", "parent", "school", "sponsor"].includes(payerKind)
        ? payerKind
        : "self";

    // For "self", payer = registrant. For other kinds, fall back to the requester
    // (parent/school admin paying on behalf) unless an explicit payerUserId is given.
    const resolvedPayerUserId = payerUserId ?? req.userId ?? null;

    const allowed = await canAccessRegistration(req.userId!, registrationId);
    if (!allowed) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }

    // Load registration + competition + student user
    const result = await pool.query(
      `SELECT
         r.id          AS reg_id,
         r.status      AS reg_status,
         r.comp_id     AS comp_id,
         r.voucher_code AS persisted_voucher_code,
         c.name        AS competition_name,
         c.fee,
         u.full_name,
         u.email,
         s.npsn        AS student_npsn
       FROM registrations r
       JOIN competitions c ON c.id = r.comp_id
       JOIN users u ON u.id = r.user_id
       LEFT JOIN students s ON s.id = r.user_id
       WHERE r.id = $1`,
      [registrationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }

    const row = result.rows[0];

    if (row.fee === 0) {
      res.status(400).json({ message: "This competition is free — no payment required" });
      return;
    }

    if (["pending_review", "approved", "completed", "paid"].includes(row.reg_status)) {
      res.status(400).json({ message: "This registration has already been paid or finalized" });
      return;
    }

    // ── Resolve the amount — apply a registration-fee voucher if present ────
    // A code passed in the body wins (and is persisted onto the registration
    // so the settlement webhook can redeem it); otherwise the persisted code.
    const bodyVoucher = typeof voucherCode === "string" && voucherCode.trim()
      ? voucherCode.trim()
      : null;
    const effectiveVoucher = bodyVoucher ?? (row.persisted_voucher_code || null);
    let chargeAmount: number = row.fee;

    if (effectiveVoucher) {
      const check = await checkVoucher(row.comp_id, effectiveVoucher, row.student_npsn);
      if (!check.valid) {
        res.status(400).json({ message: check.message ?? "Invalid voucher code." });
        return;
      }
      chargeAmount = check.discountedFee ?? row.fee;
      if (row.persisted_voucher_code !== effectiveVoucher) {
        await pool.query(
          `UPDATE registrations SET voucher_code = $1, updated_at = now() WHERE id = $2`,
          [effectiveVoucher, registrationId]
        );
      }
    }

    // A voucher that fully covers the fee — settle without Midtrans.
    if (chargeAmount <= 0) {
      const coveredOrderId = `COVERED-${registrationId}-${Date.now()}`.slice(0, 50);
      const coveredPayment = await pool.query(
        `INSERT INTO payments
           (registration_id, user_id, amount, payment_status, order_id, payer_user_id, payer_kind)
         VALUES ($1, $2, 0, 'settlement', $3, $4, $5)
         RETURNING id`,
        [registrationId, req.userId, coveredOrderId, resolvedPayerUserId, resolvedPayerKind]
      );
      await pool.query(
        `UPDATE registrations SET status = 'pending_review', updated_at = now() WHERE id = $1`,
        [registrationId]
      );
      if (effectiveVoucher) {
        await redeemVoucher(row.comp_id, effectiveVoucher, coveredPayment.rows[0].id);
      }
      res.status(201).json({ covered: true, status: "pending_review" });
      return;
    }

    // Re-use an existing pending Snap token to avoid duplicate charges — but
    // only if its amount still matches (a voucher applied later changes it).
    const existing = await pool.query(
      `SELECT id, snap_token, order_id, amount FROM payments
       WHERE registration_id = $1
         AND payment_status = 'pending'
         AND snap_token IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [registrationId]
    );

    if (existing.rows.length > 0 && Number(existing.rows[0].amount) === chargeAmount) {
      const { id, snap_token, order_id } = existing.rows[0];
      const subdomain = env.MIDTRANS_IS_PRODUCTION ? "app" : "app.sandbox";
      res.json({
        snapToken:   snap_token,
        redirectUrl: `https://${subdomain}.midtrans.com/snap/v2/vtweb/${snap_token}`,
        paymentId:   id,
        orderId:     order_id,
      });
      return;
    }

    // Generate a unique order_id — Midtrans rejects reused order_ids after expiry
    const orderId = `PAY-${registrationId}-${Date.now()}`.slice(0, 50);

    const { snapToken, redirectUrl } = await createSnapToken({
      orderId,
      amount:          chargeAmount,
      customerName:    row.full_name,
      customerEmail:   row.email,
      competitionName: row.competition_name,
    });

    const paymentResult = await pool.query(
      `INSERT INTO payments
         (registration_id, user_id, amount, payment_status, snap_token, order_id, payer_user_id, payer_kind)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
       RETURNING id`,
      [registrationId, req.userId, chargeAmount, snapToken, orderId, resolvedPayerUserId, resolvedPayerKind]
    );

    res.status(201).json({
      snapToken,
      redirectUrl,
      paymentId: paymentResult.rows[0].id,
      orderId,
    });
  } catch (err: any) {
    console.error("Create snap token error:", err);
    res.status(500).json({ message: err.message || "Failed to create payment" });
  }
});


// ── POST /api/payments/voucher/validate ──────────────────────────────────────
// Live-checks a registration-fee voucher code. No mutation — the web pay page
// calls this to preview the discounted fee before checkout.
router.post("/voucher/validate", async (req: Request, res: Response) => {
  try {
    const { registrationId, code } = req.body as { registrationId?: string; code?: string };
    if (!registrationId || !code || !code.trim()) {
      res.status(400).json({ message: "registrationId and code are required" });
      return;
    }
    if (!(await canAccessRegistration(req.userId!, registrationId))) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }
    const ctx = await loadRegContext(registrationId);
    if (!ctx) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }
    const check = await checkVoucher(ctx.compId, code.trim(), ctx.studentNpsn);
    res.json({
      valid: check.valid,
      message: check.message ?? null,
      originalFee: ctx.fee,
      discountedFee: check.valid ? check.discountedFee ?? null : null,
    });
  } catch (err) {
    console.error("Validate voucher error:", err);
    res.status(500).json({ message: "Failed to validate voucher" });
  }
});

// ── PUT /api/payments/registration/:id/voucher ───────────────────────────────
// Persists (or clears, with an empty code) the voucher chosen for a
// registration. A non-empty code is validated first.
router.put("/registration/:id/voucher", async (req: Request, res: Response) => {
  try {
    const registrationId = req.params.id as string;
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!(await canAccessRegistration(req.userId!, registrationId))) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }
    const ctx = await loadRegContext(registrationId);
    if (!ctx) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }
    if (!code) {
      await pool.query(
        `UPDATE registrations SET voucher_code = NULL, updated_at = now() WHERE id = $1`,
        [registrationId]
      );
      res.json({ voucherCode: null, originalFee: ctx.fee, discountedFee: null });
      return;
    }
    const check = await checkVoucher(ctx.compId, code, ctx.studentNpsn);
    if (!check.valid) {
      res.status(400).json({ message: check.message ?? "Invalid voucher code." });
      return;
    }
    await pool.query(
      `UPDATE registrations SET voucher_code = $1, updated_at = now() WHERE id = $2`,
      [code, registrationId]
    );
    res.json({
      voucherCode: code,
      originalFee: ctx.fee,
      discountedFee: check.discountedFee ?? null,
    });
  } catch (err) {
    console.error("Set registration voucher error:", err);
    res.status(500).json({ message: "Failed to apply voucher" });
  }
});

// ── GET /api/payments/verify/:registrationId ─────────────────────────────────
// Polls Midtrans Status API and syncs DB — fixes sandbox where webhook can't reach localhost.
// Returns { status } where status is the current registrations.status value.
router.get("/verify/:registrationId", async (req: Request, res: Response) => {
  try {
    const registrationId = req.params.registrationId as string;

    // Ensure this registration belongs to the authenticated user (or a linked parent)
    const accessible = await canAccessRegistration(req.userId!, registrationId);
    if (!accessible) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    // Look up payment record
    const payRow = await pool.query(
      `SELECT p.id AS payment_id, p.order_id, r.status as reg_status,
              r.comp_id, r.voucher_code, r.referral_code
       FROM payments p
       JOIN registrations r ON r.id = p.registration_id
       WHERE p.registration_id = $1
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [registrationId]
    );

    if (payRow.rows.length === 0) {
      res.json({ status: "no_payment" });
      return;
    }

    const { payment_id, order_id, reg_status, comp_id, voucher_code, referral_code } =
      payRow.rows[0];

    // If already in post-payment state, nothing to do
    if (["pending_review", "approved", "paid"].includes(reg_status)) {
      res.json({ status: reg_status });
      return;
    }

    // Ask Midtrans for the real transaction status
    let txStatus: string;
    try {
      txStatus = await getTransactionStatus(order_id);
    } catch {
      // Midtrans returns 404 if transaction doesn't exist yet — not an error
      res.json({ status: reg_status });
      return;
    }

    const isSettled =
      txStatus === "settlement" ||
      txStatus === "capture";

    if (isSettled) {
      // Update DB to match Midtrans — same logic as webhook
      await pool.query(
        `UPDATE payments SET payment_status = 'settlement', updated_at = now()
         WHERE order_id = $1`,
        [order_id]
      );
      const settled = await pool.query(
        `UPDATE registrations SET status = 'pending_review', updated_at = now()
          WHERE id = $1
            AND status NOT IN ('pending_review','approved','paid','completed')
        RETURNING id`,
        [registrationId]
      );
      if ((settled.rowCount ?? 0) > 0) {
        // First settle — redeem the voucher + credit the referral.
        if (voucher_code && comp_id) {
          await redeemVoucher(comp_id, voucher_code, payment_id);
        }
        if (referral_code && comp_id) {
          await creditReferralPaid(comp_id, referral_code);
        }
      }
      console.log(`Verify endpoint: payment settled for registration ${registrationId} (order ${order_id}) → pending_review`);
      res.json({ status: "pending_review" });
      return;
    }

    res.json({ status: reg_status });
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ message: "Internal error" });
  }
});

// ── GET /api/payments/redirect/:registrationId ───────────────────────────────
// T9: Returns a short-lived redirect URL (1 h JWT) for the organizer's post-payment page.
// Mobile app shows a "Continue to organizer portal" button using this URL.
router.get("/redirect/:registrationId", async (req: Request, res: Response) => {
  try {
    const { registrationId } = req.params;

    // Verify registration belongs to this user and payment has settled
    const result = await pool.query(
      `SELECT r.id, r.comp_id, r.registration_number,
              c.post_payment_redirect_url,
              p.payment_status
       FROM registrations r
       JOIN competitions c ON c.id = r.comp_id
       LEFT JOIN payments p ON p.registration_id = r.id
       WHERE r.id = $1 AND r.user_id = $2
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [registrationId, req.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: "Registration not found" });
      return;
    }

    const row = result.rows[0];

    if (!["settlement", "capture"].includes(row.payment_status)) {
      res.status(400).json({ message: "Payment has not been settled yet" });
      return;
    }

    if (!row.post_payment_redirect_url) {
      res.json({ redirectUrl: null, message: "No redirect URL configured for this competition" });
      return;
    }

    // Generate a 1-hour JWT embedding the registration context
    const redirectToken = jwt.sign(
      { sub: req.userId, registrationId, compId: row.comp_id },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Persist the latest token so organizer portals can optionally verify it server-side
    await pool.query(
      "UPDATE registrations SET redirect_token = $1 WHERE id = $2",
      [redirectToken, registrationId]
    );

    const separator = row.post_payment_redirect_url.includes("?") ? "&" : "?";
    const redirectUrl = `${row.post_payment_redirect_url}${separator}token=${redirectToken}`;

    res.json({
      redirectUrl,
      registrationNumber: row.registration_number,
    });
  } catch (err) {
    console.error("GET /payments/redirect/:registrationId error:", err);
    res.status(500).json({ message: "Failed to generate redirect URL" });
  }
});

// ── POST /api/payments/school-batch ─────────────────────────────────────────
// School admin creates a batch payment for multiple student registrations.
// Body: { registrationIds: string[] }
// Returns: { batchId, snapToken, snapRedirectUrl, totalAmount }
router.post(
  "/school-batch",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const actorId = req.userId!;
      const actorRole = (req as any).userRole as string;

      if (actorRole !== "school_admin" && actorRole !== "teacher") {
        res.status(403).json({ message: "Only school admins or teachers can create batch payments" });
        return;
      }

      const { registrationIds } = req.body as { registrationIds: string[] };

      if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
        res.status(400).json({ message: "registrationIds must be a non-empty array" });
        return;
      }

      // Load each registration with status + fee
      const regsResult = await pool.query(
        `SELECT r.id, r.user_id, r.status, r.comp_id,
                c.fee AS competition_fee, u.school_id AS student_school_id
         FROM registrations r
         JOIN users u ON u.id = r.user_id
         JOIN competitions c ON c.id = r.comp_id
         WHERE r.id = ANY($1::uuid[])`,
        [registrationIds]
      );

      if (regsResult.rows.length !== registrationIds.length) {
        res.status(404).json({ message: "One or more registrations not found" });
        return;
      }

      if (actorRole === "school_admin") {
        // Fetch admin's school_id and validate students belong to this school
        const adminRow = await pool.query(
          "SELECT school_id FROM users WHERE id = $1",
          [actorId]
        );
        if (!adminRow.rows[0]?.school_id) {
          res.status(403).json({ message: "Your account is not linked to a school" });
          return;
        }
        const schoolId: string = adminRow.rows[0].school_id;
        for (const row of regsResult.rows) {
          if (row.student_school_id !== schoolId) {
            res.status(403).json({
              message: `Registration ${row.id} does not belong to a student in your school`,
            });
            return;
          }
        }
      } else {
        // Teacher: validate all students are in teacher_student_links
        const linkedResult = await pool.query(
          `SELECT student_id FROM teacher_student_links WHERE teacher_id = $1`,
          [actorId]
        );
        const linkedIds = new Set(linkedResult.rows.map((r: { student_id: string }) => r.student_id));
        for (const row of regsResult.rows) {
          if (!linkedIds.has(row.user_id)) {
            res.status(403).json({
              message: `Registration ${row.id} does not belong to one of your linked students`,
            });
            return;
          }
        }
      }

      for (const row of regsResult.rows) {
        if (!["registered", "pending_payment"].includes(row.status)) {
          res.status(400).json({
            message: `Registration ${row.id} has status '${row.status}' and cannot be batched`,
          });
          return;
        }
      }

      // Use school_id from first student's record for the batch (teachers may span schools)
      const schoolId: string = regsResult.rows[0].student_school_id;

      const totalAmount: number = regsResult.rows.reduce(
        (sum: number, r: { competition_fee: number }) => sum + Number(r.competition_fee),
        0
      );

      // Fetch actor email + school name for Midtrans customer details.
      // Spec F-PY-03 / 16.4: bulk payments are "Dibayar oleh sekolah", so
      // the Midtrans receipt is issued in the school's name with the
      // coordinator as the contact email. The previous implementation put
      // the coordinator's personal name on the receipt, which made
      // reimbursement ambiguous.
      const actorEmailRow = await pool.query(
        "SELECT email FROM users WHERE id = $1",
        [actorId]
      );
      const schoolRow = await pool.query(
        "SELECT name FROM schools WHERE id = $1",
        [schoolId]
      );
      const adminEmail: string = actorEmailRow.rows[0]?.email ?? "";
      const customerName: string = (schoolRow.rows[0]?.name as string | undefined) ?? "School";

      // Create Midtrans Snap token for the total
      const orderId = `BATCH-${Date.now()}`;
      const snapResult = await createSnapToken({
        orderId,
        amount: totalAmount,
        customerName,
        customerEmail: adminEmail,
        competitionName: `School Batch (${registrationIds.length} registrations)`,
      });

      // Persist the batch
      const batchResult = await pool.query(
        `INSERT INTO school_payment_batches
           (school_id, created_by, total_amount, status, snap_token, snap_redirect_url)
         VALUES ($1, $2, $3, 'pending', $4, $5)
         RETURNING id`,
        [schoolId, actorId, totalAmount, snapResult.snapToken, snapResult.redirectUrl]
      );
      const batchId: string = batchResult.rows[0].id;

      // Insert batch items
      for (const row of regsResult.rows) {
        await pool.query(
          `INSERT INTO school_payment_batch_items (batch_id, registration_id, amount)
           VALUES ($1, $2, $3)`,
          [batchId, row.id, Number(row.competition_fee)]
        );
        // Mark each registration as pending_payment so it can't be double-batched
        await pool.query(
          "UPDATE registrations SET status = 'pending_payment' WHERE id = $1",
          [row.id]
        );
      }

      res.status(201).json({
        batchId,
        snapToken: snapResult.snapToken,
        snapRedirectUrl: snapResult.redirectUrl,
        totalAmount,
      });
    } catch (err) {
      console.error("POST /payments/school-batch error:", err);
      res.status(500).json({ message: "Failed to create school payment batch" });
    }
  }
);

export default router;
