import midtransClient from "midtrans-client";
import { env } from "../config/env";

// Snap is the Midtrans hosted payment page (handles all payment methods)
const snap = new midtransClient.Snap({
  isProduction: env.MIDTRANS_IS_PRODUCTION,
  serverKey: env.MIDTRANS_SERVER_KEY,
  clientKey: env.MIDTRANS_CLIENT_KEY,
});

// Core API is used for server-side operations like refunds
const coreApi = new midtransClient.CoreApi({
  isProduction: env.MIDTRANS_IS_PRODUCTION,
  serverKey: env.MIDTRANS_SERVER_KEY,
  clientKey: env.MIDTRANS_CLIENT_KEY,
});

// On a SHARED Midtrans merchant account (Competzy reuses the legacy
// EMC/kompetisi.net account), the dashboard's global Payment Notification URL
// points at the legacy backend. Override it per-transaction to Competzy's own
// webhook so Midtrans notifies US — not the legacy site — for our transactions,
// without touching the shared dashboard config. `X-Override-Notification`
// replaces the URL for these requests only; the legacy site's own transactions
// keep using the dashboard URL. Set MIDTRANS_NOTIFICATION_URL to
// https://api.competzy.com/api/payments/webhook on the backend service.
// (If unset, we fall back to the dashboard URL + the verify-poll backstop.)
if (env.MIDTRANS_NOTIFICATION_URL) {
  try {
    // midtrans-client 1.4.3 wraps an axios instance at snap.httpClient.http_client;
    // a default `common` header rides along with every Snap charge request.
    (snap as unknown as {
      httpClient: { http_client: { defaults: { headers: { common: Record<string, string> } } } };
    }).httpClient.http_client.defaults.headers.common["X-Override-Notification"] =
      env.MIDTRANS_NOTIFICATION_URL;
  } catch (err) {
    console.warn(
      "[midtrans] Failed to set X-Override-Notification header — Midtrans will use the dashboard notification URL; payment confirmation falls back to the verify-poll.",
      err,
    );
  }
}

// Fail-loud config validation. Midtrans silently returns 401 on a wrong key,
// and a sandbox/production mismatch is easy to miss — these warnings surface
// the common misconfigurations at boot (e.g. the Merchant ID "M0123456789"
// pasted into CLIENT_KEY, or a production key left in sandbox mode). Logs
// only, never blocks — mirrors the SMTP config warning.
function validateMidtransConfig(): void {
  const sk = env.MIDTRANS_SERVER_KEY;
  const ck = env.MIDTRANS_CLIENT_KEY;
  const prod = env.MIDTRANS_IS_PRODUCTION;
  const notif = env.MIDTRANS_NOTIFICATION_URL;
  const warn = (m: string) => console.warn(`[midtrans] CONFIG: ${m}`);

  if (!sk || !ck) {
    warn("MIDTRANS_SERVER_KEY / MIDTRANS_CLIENT_KEY not set — payments are disabled.");
    return;
  }
  const skSandbox = sk.startsWith("SB-Mid-server-");
  const skProd = sk.startsWith("Mid-server-");
  const ckSandbox = ck.startsWith("SB-Mid-client-");
  const ckProd = ck.startsWith("Mid-client-");

  if (!skSandbox && !skProd)
    warn(`MIDTRANS_SERVER_KEY is not a server key (expected "Mid-server-..." or "SB-Mid-server-...").`);
  if (!ckSandbox && !ckProd)
    warn(`MIDTRANS_CLIENT_KEY is not a client key (expected "Mid-client-..." or "SB-Mid-client-..."). A value like "M0123456789" is the Merchant ID, NOT the Client Key.`);
  if (prod && (skSandbox || ckSandbox))
    warn("MIDTRANS_IS_PRODUCTION=true but a SANDBOX key (SB-...) is configured — production charges will fail.");
  if (!prod && (skProd || ckProd))
    warn("MIDTRANS_IS_PRODUCTION=false but a PRODUCTION key is configured — set MIDTRANS_IS_PRODUCTION=true to go live (sandbox charges will fail against a production key).");
  if (notif && !/\/(webhook|notification)/i.test(notif))
    warn(`MIDTRANS_NOTIFICATION_URL ("${notif}") does not look like a server-to-server webhook — payment notifications may go to the wrong place. Expected e.g. https://api.competzy.com/api/payments/webhook`);
}
validateMidtransConfig();

const DEEP_LINK_BASE = "competzy://payment";

export interface SnapTokenResult {
  snapToken: string;
  redirectUrl: string;
}

/**
 * Create a Midtrans Snap transaction token for a registration.
 *
 * `returnUrl` (web only) is where Midtrans redirects the browser after the
 * payment finishes — our animated /payment/success page. When omitted (mobile),
 * the callbacks fall back to the `competzy://` deep-link scheme so the app
 * reopens. The success page never trusts the redirect; it re-verifies the
 * status server-side.
 */
export async function createSnapToken(params: {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  competitionName: string;
  returnUrl?: string;
}): Promise<SnapTokenResult> {
  if (!env.MIDTRANS_SERVER_KEY) {
    throw new Error("MIDTRANS_SERVER_KEY is not configured");
  }

  const callbacks = params.returnUrl
    ? { finish: params.returnUrl, error: params.returnUrl, pending: params.returnUrl }
    : {
        finish:  `${DEEP_LINK_BASE}/finish`,
        error:   `${DEEP_LINK_BASE}/error`,
        pending: `${DEEP_LINK_BASE}/pending`,
      };

  const transaction = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.amount,
    },
    item_details: [
      {
        id: params.orderId,
        price: params.amount,
        quantity: 1,
        name: params.competitionName.slice(0, 50),
      },
    ],
    customer_details: {
      first_name: params.customerName,
      email: params.customerEmail,
    },
    callbacks,
  };

  const response = await snap.createTransaction(transaction);
  return {
    snapToken: response.token,
    redirectUrl: response.redirect_url,
  };
}

/**
 * Fetch the current transaction status from Midtrans for a given order ID.
 * Returns the raw transaction_status string (e.g. "settlement", "pending", "cancel").
 */
export async function getTransactionStatus(orderId: string): Promise<string> {
  const response = await (coreApi as any).transaction.status(orderId);
  return response.transaction_status as string;
}

export interface RefundResult {
  refundKey: string;
  status: string;
  refundAmount: number;
}

/**
 * Issue a refund for a settled Midtrans transaction.
 * Works for GoPay, OVO, Dana, and credit card (online refund).
 * Bank transfer / VA refunds are offline and cannot be automated — this will throw.
 */
export async function refundPayment(
  orderId: string,
  amount: number,
  reason: string
): Promise<RefundResult> {
  if (!env.MIDTRANS_SERVER_KEY) {
    throw new Error("MIDTRANS_SERVER_KEY is not configured");
  }

  const refundKey = `${orderId}-refund-${Date.now()}`;
  // midtrans-client has no TS types for transaction — cast to any
  const response = await (coreApi as any).transaction.refund(orderId, {
    refund_key: refundKey,
    amount,
    reason,
  });

  return {
    refundKey,
    status: response.transaction_status ?? "unknown",
    refundAmount: Number(response.refund_amount ?? amount),
  };
}
