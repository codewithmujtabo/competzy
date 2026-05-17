import { apiRequest } from "./api";

// Marketing surfaces (EMC Wave 10 backend) — the student-facing reads:
// announcements, study materials, and submitting feedback.

export interface Announcement {
  id: string;
  compId: string | null; // null = a platform-wide post
  title: string;
  body: string | null;
  type: string | null;
  image: string | null;
  file: string | null;
  isActive: boolean;
  isFeatured: boolean;
  publishedAt: string | null;
  createdAt: string;
}

/** Published announcements for a competition, plus every platform-wide post. */
export async function getAnnouncements(compId: string): Promise<Announcement[]> {
  return apiRequest<Announcement[]>(
    `/announcements?compId=${encodeURIComponent(compId)}`
  );
}

export interface Material {
  id: string;
  compId: string | null; // null = a platform-wide material
  title: string;
  body: string | null;
  type: string | null;
  category: string | null;
  grades: string[];
  image: string | null;
  file: string | null;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
}

/** Published study materials for a competition, plus every platform-wide one. */
export async function getMaterials(compId: string): Promise<Material[]> {
  return apiRequest<Material[]>(`/materials?compId=${encodeURIComponent(compId)}`);
}

/** Submit a piece of feedback for a competition to the organizer's inbox. */
export async function sendSuggestion(
  compId: string,
  content: string
): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>("/suggestions", {
    method: "POST",
    body: { compId, content },
  });
}
