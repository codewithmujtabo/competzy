// types/index.ts

export interface Competition {
  id: string;
  name: string;
  organizer_name: string;
  category?: string;
  grade_level?: string;
  fee: number;
  quota?: number;
  reg_open_date?: string;
  reg_close_date?: string;
  competition_date?: string;
  required_docs?: string[];
  description?: string;
  image_url?: string;
  logo_url?: string;
  website_url?: string;
  // Free-text column; the admin/organizer forms restrict it to the canonical
  // COMPETITION_STATUSES (Coming Soon / Registration Opened / Registration Closed).
  registration_status?: string;
  poster_url?: string;
  is_international?: boolean;
  detailed_description?: string;
  round_count?: number;
  participant_instructions?: string;
  created_by?: string;
  post_payment_redirect_url?: string;
  kind?: 'native' | 'affiliated';
  created_at?: string;
  
  // Дополнительные поля для фронтенда (не из БД)
  total_registrations?: number;
  confirmed_registrations?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  // Backend returns `fullName` (camelCase); legacy admin code reads `full_name`.
  // Both forms appear depending on which fetch path populated the object.
  full_name?: string;
  fullName?: string;
  phone?: string;
  city?: string;
  role: string;
  photoUrl?: string;
  createdAt?: string;
  school_id?: string;
  kid?: string;
  // school_admin
  schoolVerificationStatus?: 'pending_verification' | 'verified' | 'rejected';
  schoolRejectionReason?: string;
  // student
  school?: string;
  grade?: string;
  nisn?: string;
  // parent
  childName?: string;
  childSchool?: string;
  childGrade?: string;
  relationship?: string;
  // teacher
  subject?: string;
  department?: string;
  npsn?: string;
  teacherVerificationStatus?: 'pending_verification' | 'verified' | 'rejected';
  teacherRejectionReason?: string;
  // super-admin / impersonation (from GET /auth/me)
  isSuperAdmin?: boolean;
  impersonating?: boolean;
  impersonatedBy?: { id: string; fullName: string | null; email: string | null } | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface School {
  id: string;
  name: string;
  province: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  status?: string;
  npsn?: string;
  created_at?: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  school_id?: string | null;
  school_name?: string | null;
  phone?: string | null;
  city?: string;
  created_at?: string;
}

export interface PendingRegistration {
  registrationId: string;
  registrationNumber?: string | null;
  status: string;
  registeredAt: string;
  student: {
    id?: string;
    name: string;
    email: string;
    phone?: string;
    country?: string | null;
    city?: string | null;
    province?: string | null;
    school?: string;
    grade?: string;
    nisn?: string;
  };
  competition: {
    id: string;
    name: string;
    fee: number;
    feeInternational?: number | null;
  };
  round?: { id: string; name: string } | null;
}