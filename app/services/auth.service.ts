import { apiRequest } from "./api";
import { setToken, clearToken } from "./token.service";

interface AuthResponse {
  token: string;
  user: any;
}

// Step 1 of signup: email a 6-digit verification code. When SMTP is not
// configured (local dev) the backend returns the code in `devCode` and accepts
// the universal "000000" — mirroring the phone-OTP dev bypass.
export interface SendSignupCodeResponse {
  message: string;
  devBypass?: boolean;
  devCode?: string;
  expiresInMinutes?: number;
}

export async function sendSignupCode(email: string): Promise<SendSignupCodeResponse> {
  return apiRequest<SendSignupCodeResponse>("/auth/signup/send-code", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

export async function signup(params: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  country?: string;                     // ISO 3166-1 alpha-2 (e.g. "ID", "MY")
  role: string;
  roleData: any;
  consentAccepted: boolean;
  verificationCode: string;             // step-2: the emailed code (or "000000" in dev)
}): Promise<AuthResponse> {
  const data = await apiRequest<AuthResponse>("/auth/signup", {
    method: "POST",
    body: params,
    auth: false,
  });
  await setToken(data.token);
  return data;
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const data = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  await setToken(data.token);
  return data;
}

export async function sendOtp(email: string): Promise<void> {
  await apiRequest("/auth/send-otp", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

export async function verifyOtp(
  email: string,
  code: string
): Promise<AuthResponse> {
  const data = await apiRequest<AuthResponse>("/auth/verify-otp", {
    method: "POST",
    body: { email, code },
    auth: false,
  });
  await setToken(data.token);
  return data;
}

export async function sendPhoneOtp(phone: string): Promise<void> {
  await apiRequest("/auth/phone/send-otp", {
    method: "POST",
    body: { phone },
    auth: false,
  });
}

export async function verifyPhoneOtp(
  phone: string,
  code: string
): Promise<AuthResponse | { noAccount: true; phone: string } | { historicalMatch: true; phone: string; fullName: string; email: string }> {
  try {
    const data = await apiRequest<AuthResponse | { historicalMatch: true; phone: string; fullName: string; email: string }>("/auth/phone/verify-otp", {
      method: "POST",
      body: { phone, code },
      auth: false,
    });
    if ("historicalMatch" in data) return data;
    await setToken((data as AuthResponse).token);
    return data as AuthResponse;
  } catch (err: any) {
    if (err.message === "NO_ACCOUNT") {
      return { noAccount: true, phone };
    }
    throw err;
  }
}

export async function getMe(): Promise<any | null> {
  try {
    return await apiRequest("/auth/me");
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await clearToken();
}

// ── Password reset ────────────────────────────────────────────────────────
// Backend endpoints land from Sprint 20 Phase B. forgotPassword always returns
// 200 (no enumeration) — the caller treats both "we sent an email" and "no
// such account" identically. resetPassword takes the token from the email
// link (mobile: arrives via the deep-link handler in expo-router).

export async function forgotPassword(email: string): Promise<void> {
  await apiRequest("/auth/forgot-password", {
    method: "POST",
    body: { email },
    auth: false,
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await apiRequest("/auth/reset-password", {
    method: "POST",
    body: { token, password },
    auth: false,
  });
}
