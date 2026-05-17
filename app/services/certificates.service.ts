import { apiRequest } from "./api";
import { API_BASE_URL } from "../config/api";

// Certificate surfaces (EMC Wave 12 backend) — the student's own certificates.

export interface Certificate {
  id: string;
  compId: string;
  certificateNumber: string;
  verificationCode: string;
  type: string; // "participation" | "achievement"
  awardLabel: string | null;
  studentName: string;
  competitionName: string;
  grade: string | null;
  score: number | null;
  scoreMax: number | null;
  issuedAt: string;
  revokedAt: string | null;
}

/** The signed-in student's certificates for a competition. */
export async function getMine(compId: string): Promise<Certificate[]> {
  return apiRequest<Certificate[]>(
    `/certificates/mine?compId=${encodeURIComponent(compId)}`
  );
}

/**
 * The public certificate-PDF URL. No auth — the verification code is the
 * capability — so it opens directly in the in-app browser.
 */
export function certificatePdfUrl(verificationCode: string): string {
  return `${API_BASE_URL}/certificates/verify/${encodeURIComponent(verificationCode)}/pdf`;
}
