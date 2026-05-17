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
