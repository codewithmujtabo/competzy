import { apiRequest } from "./api";
import { API_BASE_URL } from "@/config/api";
import { getToken } from "./token.service";

export interface SnapTokenResponse {
  snapToken?:   string;
  redirectUrl?: string;
  paymentId?:   string;
  orderId?:     string;
  // A registration-fee voucher that fully covers the fee settles without
  // Midtrans — the backend returns { covered: true } instead of a token.
  covered?:     boolean;
  status?:      string;
}

export type PayerKind = "self" | "parent" | "school" | "sponsor";

/**
 * Request a Midtrans Snap token for a pending registration.
 * Returns the redirect URL to open in the WebBrowser.
 *
 * payerKind: who is paying. Defaults to "self". Used for receipt attribution
 * (Spec F-PY-03: parent reimbursement requires receipt in payer's name).
 * voucherCode: an optional registration-fee voucher — the backend charges
 * the discounted fee (or returns { covered: true } when it covers the fee).
 */
export async function createSnapToken(
  registrationId: string,
  payerKind: PayerKind = "self",
  voucherCode?: string
): Promise<SnapTokenResponse> {
  return apiRequest<SnapTokenResponse>("/payments/snap", {
    method: "POST",
    body: { registrationId, payerKind, voucherCode },
  });
}

export interface VoucherValidation {
  valid: boolean;
  message: string | null;
  originalFee: number;
  discountedFee: number | null;
}

/** Live-check a registration-fee voucher — no mutation, previews the fee. */
export async function validateVoucher(
  registrationId: string,
  code: string
): Promise<VoucherValidation> {
  return apiRequest<VoucherValidation>("/payments/voucher/validate", {
    method: "POST",
    body: { registrationId, code },
  });
}

export interface ManualPaymentIntent {
  paymentId: string;
  amount: number;
  paymentStatus: string;
  proofUrl: string | null;
}

export async function createManualIntent(
  registrationId: string
): Promise<ManualPaymentIntent> {
  return apiRequest<ManualPaymentIntent>("/payments/manual-intent", {
    method: "POST",
    body: { registrationId },
  });
}

/**
 * Ask the backend to check Midtrans' Status API and sync the DB.
 * Fixes sandbox environments where Midtrans can't reach localhost to fire the webhook.
 * Returns the current registration status after the sync.
 */
export async function verifyPayment(
  registrationId: string
): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(`/payments/verify/${registrationId}`);
}

export async function getPostPaymentRedirectUrl(
  registrationId: string
): Promise<{ redirectUrl: string; registrationNumber: string | null }> {
  return apiRequest<{ redirectUrl: string; registrationNumber: string | null }>(
    `/payments/redirect/${registrationId}`
  );
}

export async function uploadPaymentProof(
  paymentId: string,
  file: { uri: string; name: string; mimeType?: string | null }
): Promise<{ message: string; proofUrl: string; status: string }> {
  const token = await getToken();
  const formData = new FormData();
  formData.append("proof", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || "application/octet-stream",
  } as any);

  const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/upload-proof`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to upload payment proof");
  }

  return data;
}
