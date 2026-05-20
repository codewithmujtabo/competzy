import { apiRequest } from "./api";
import { getToken } from "./token.service";
import { API_BASE_URL } from "../config/api";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  city: string;
  country: string | null;
  role: string;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  // Student-specific fields
  schoolName?: string;
  grade?: string;
  nisn?: string;
  dateOfBirth?: string;
  interests?: string;
  referralSource?: string;
  studentCardUrl?: string | null;
  npsn?: string;
  schoolAddress?: string;
  schoolEmail?: string;
  schoolWhatsapp?: string;
  schoolPhone?: string;
  supervisorName?: string;
  supervisorEmail?: string;
  supervisorWhatsapp?: string;
  supervisorPhone?: string;
  supervisorSchoolId?: string;
  supervisorLinked?: boolean;
  parentName?: string;
  parentOccupation?: string;
  parentWhatsapp?: string;
  parentPhone?: string;
  parentSchoolId?: string;
  parentLinked?: boolean;
}

export async function getProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>("/users/me");
}

export async function updateProfile(data: Partial<UserProfile>): Promise<void> {
  await apiRequest("/users/me", {
    method: "PUT",
    body: data,
  });
}

/**
 * Upload profile photo.
 * Accepts a local file URI (from ImagePicker).
 */
export async function uploadPhoto(fileUri: string): Promise<{ photoUrl: string }> {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");

  // Create FormData
  const formData = new FormData();
  const filename = fileUri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("photo", {
    uri: fileUri,
    name: filename,
    type,
  } as any);

  const res = await fetch(`${API_BASE_URL}/users/photo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to upload photo");
  }

  return res.json();
}

/**
 * Upload student card.
 * Accepts a local file URI (from ImagePicker or DocumentPicker).
 */
export async function uploadStudentCard(fileUri: string): Promise<{ studentCardUrl: string }> {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");

  const formData = new FormData();
  const filename = fileUri.split("/").pop() || "card.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("card", {
    uri: fileUri,
    name: filename,
    type,
  } as any);

  const res = await fetch(`${API_BASE_URL}/users/student-card`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Failed to upload student card");
  }

  return res.json();
}
