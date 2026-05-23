import Stripe from "stripe";
import { env } from "../config/env";

// Stripe Checkout — international (USD) sibling of midtrans.service.ts. We
// use the hosted Checkout Session API (not Payment Intents) so the browser /
// WebView simply navigates to Stripe's URL and we never touch card data.
//
// Stripe SDK v22 exports a namespace-merged callable: the imported `Stripe`
// is the runtime constructor, `Stripe.Stripe` is the instance type, and
// `Stripe.Event` is the webhook event type. Hence the slightly awkward type
// annotations below.

type StripeClient = Stripe.Stripe;
let _stripe: StripeClient | null = null;

function client(): StripeClient {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!_stripe) {
    // apiVersion left to the SDK's pinned default — the type is a string literal
    // union that's bumped each SDK release; pinning it here only invites churn.
    _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!env.STRIPE_SECRET_KEY;
}

export interface StripeCheckoutResult {
  sessionId: string;
  checkoutUrl: string;
}

/**
 * Create a Stripe Checkout Session for a registration payment.
 * `amountUsd` is in whole dollars (the API converts to cents internally).
 * `orderId` is our internal payments.order_id; we round-trip it through
 * `client_reference_id` + `metadata.orderId` so the webhook can match it.
 */
export async function createStripeCheckoutSession(params: {
  orderId: string;
  amountUsd: number;
  customerName: string;
  customerEmail: string;
  competitionName: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeCheckoutResult> {
  const cents = Math.round(params.amountUsd * 100);
  if (cents < 100) {
    // Stripe rejects sub-dollar charges and the round will round-trip as 0 anyway.
    throw new Error("Stripe minimum is $1.00 USD");
  }

  const session = await client().checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    client_reference_id: params.orderId,
    customer_email: params.customerEmail || undefined,
    metadata: {
      orderId: params.orderId,
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: cents,
          product_data: {
            name: params.competitionName.slice(0, 250),
            description: `Registration for ${params.customerName}`.slice(0, 250),
          },
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (!session.url) {
    throw new Error("Stripe Checkout Session returned without a URL");
  }
  return { sessionId: session.id, checkoutUrl: session.url };
}

/**
 * Look up the status of a Checkout Session — used by the verify poll path
 * when the web client lands back on our dashboard before the webhook arrives.
 * Returns Stripe's `payment_status` ("paid" | "unpaid" | "no_payment_required").
 */
export async function getCheckoutSessionStatus(sessionId: string): Promise<string> {
  const session = await client().checkout.sessions.retrieve(sessionId);
  return session.payment_status ?? "unpaid";
}

/**
 * Verify a webhook payload signature. Returns the parsed Stripe Event when
 * valid; throws otherwise. The webhook endpoint must use raw body parsing —
 * Stripe signs the exact bytes, not JSON-roundtripped.
 */
// The webhook event type — derived from the SDK method itself so we don't have
// to navigate the SDK's (somewhat awkward) namespace re-exports in v22 CJS.
export type StripeEvent = ReturnType<StripeClient["webhooks"]["constructEvent"]>;

export function constructWebhookEvent(
  rawBody: Buffer | string,
  signature: string,
): StripeEvent {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return client().webhooks.constructEvent(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  );
}
