// Types for the global "My Account" area.
//
// The competition auth context only carries a snapshot of the user
// (school / grade / nisn). The My Account pages need the full record, so they
// fetch `GET /api/users/me` directly — its student-role shape is below.

export interface StudentProfile {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  city: string | null;
  role: string;
  photoUrl: string | null;
  // Student profile — present only when role === 'student'.
  schoolName: string | null;
  grade: string | null;
  nisn: string | null;
  dateOfBirth: string | null;
  interests: string | null;
  referralSource: string | null;
  studentCardUrl: string | null;
  npsn: string | null;
  schoolAddress: string | null;
  schoolEmail: string | null;
  schoolWhatsapp: string | null;
  schoolPhone: string | null;
  supervisorName: string | null;
  supervisorEmail: string | null;
  supervisorWhatsapp: string | null;
  supervisorPhone: string | null;
  parentName: string | null;
  parentOccupation: string | null;
  parentWhatsapp: string | null;
  parentPhone: string | null;
}
