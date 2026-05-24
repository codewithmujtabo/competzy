/**
 * Mock user for development.
 * When you're ready for real auth, replace this file with
 * a real Supabase/API call — nothing else in the app changes.
 */

export type UserRole =
  | "student"
  | "parent"
  | "teacher";
export type GradeLevel =
  | "SD"
  | "SMP"
  | "SMA";

export interface AppUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  school: string;
  city: string;
  province?: string;
  country?: string;             // ISO 3166-1 alpha-2; null when not yet set
  level?: GradeLevel; // only relevant for students
  avatarUrl?: string;
  // teacher-specific
  subject?: string;
  // parent-specific
  childName?: string;
  childSchool?: string;
  childLevel?: GradeLevel;

  // ── Sprint 2: Enhanced student profile fields ─────────────────────────────
  // Student details
  fullName?: string;
  dateOfBirth?: string;
  interests?: string;
  referralSource?: string;
  studentCardUrl?: string;
  nisn?: string;

  // School details
  schoolName?: string;
  npsn?: string;
  schoolAddress?: string;
  schoolEmail?: string;
  schoolWhatsapp?: string;
  schoolPhone?: string;

  // Supervisor details
  supervisorName?: string;
  supervisorEmail?: string;
  supervisorWhatsapp?: string;
  supervisorPhone?: string;
  supervisorSchoolId?: string;
  supervisorLinked?: boolean;

  // Parent details
  parentName?: string;
  parentOccupation?: string;
  parentWhatsapp?: string;
  parentPhone?: string;
  parentSchoolId?: string;
  parentLinked?: boolean;
}

export const MOCK_USER: AppUser = {
  id: "dev-user-001",
  name: "Budi Santoso",
  phone: "08123456789",
  email: "budi@example.com",
  role: "student",
  school: "SMP Negeri 1 Jakarta",
  city: "Jakarta",
  level: "SMP",
};

/**
 * Set DEV_BYPASS_AUTH to true  → app skips login, uses MOCK_USER
 * Set DEV_BYPASS_AUTH to false → app goes through real login flow
 */
export const DEV_BYPASS_AUTH = false;
