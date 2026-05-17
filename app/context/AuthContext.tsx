/**
 * AuthContext — single source of truth for auth state, user profile,
 * and in-memory registrations (T9 will add API persistence).
 *
 * Replaces the previous split between AuthContext + UserContext.
 * Import useAuth() or useUser() (alias) from this file.
 */

import * as authService from "@/services/auth.service";
import * as userService from "@/services/user.service";
import * as registrationsService from "@/services/registrations.service";
import { AppUser } from "@/constants/mock-user";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

export type { AppUser };

export type RegistrationStatus =
  | "pending_payment"
  | "pending_review"
  | "approved"
  | "rejected"
  | "paid"
  | "submitted"
  | "completed"
  | "pending_approval"  // legacy
  | "registered";       // legacy

export interface Registration {
  id: string;
  compId: string;
  competitionName: string;
  fee: number;
  status: RegistrationStatus;
  createdAt: string;
  registrationNumber?: string | null;
  meta?: Record<string, any>;
}

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  // Auth actions
  login: (email: string, password: string) => Promise<void>;
  signup: (params: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    province?: string;
    city: string;
    role: string;
    roleData: any;
    consentAccepted: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  // Profile refresh (call after profile edits)
  fetchUser: (userId?: string) => Promise<void>;
  registrations: Registration[];
  registerCompetition: (
    compId: string,
    meta?: Record<string, any>
  ) => Promise<Registration>;
  markRegistrationPaid: (id: string) => Promise<void>;
  removeRegistration: (id: string) => Promise<void>;
  lastRegisteredId: string | null;
  clearLastRegistered: () => void;
  // setUser exposed for screens that directly update profile fields
  setUser: (user: AppUser | null) => void;
  // Refresh registrations list (for pull-to-refresh)
  refreshRegistrations: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  error: null,
  isAuthenticated: false,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  clearError: () => {},
  fetchUser: async () => {},
  registrations: [],
  registerCompetition: async () => ({
    id: "",
    compId: "",
    competitionName: "",
    fee: 0,
    status: "registered",
    createdAt: "",
  }),
  markRegistrationPaid: async () => {},
  removeRegistration: async () => {},
  lastRegisteredId: null,
  clearLastRegistered: () => {},
  setUser: () => {},
  refreshRegistrations: async () => {},
});

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [lastRegisteredId, setLastRegisteredId] = useState<string | null>(null);

  const isAuthenticated = user !== null;

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      setIsLoading(true);
      const me = await authService.getMe();
      if (!me) {
        setUser(null);
        return;
      }
      await Promise.all([loadProfile(), loadRegistrations()]);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRegistrations() {
    try {
      const regs = await registrationsService.list();
      setRegistrations(regs);
    } catch {
      // Non-fatal — user still sees empty list
    }
  }

  async function loadProfile() {
    const data = await userService.getProfile();
    if (data) {
      setUser(mapProfile(data));
    }
  }

  // fetchUser is the public-facing refresh — userId arg kept for
  // backwards compat with existing callers (register.tsx, login.tsx)
  async function fetchUser(_userId?: string) {
    try {
      await loadProfile();
    } catch (err) {
      console.error("Error fetching user:", err);
    }
  }


  async function login(email: string, password: string) {
    try {
      setError(null);
      setIsLoading(true);
      await authService.login(email, password);
      await Promise.all([loadProfile(), loadRegistrations()]);
    } catch (err: any) {
      setError(err?.message || "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function signup(params: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    province?: string;
    city: string;
    role: string;
    roleData: any;
    consentAccepted: boolean;
  }) {
    try {
      setError(null);
      setIsLoading(true);
      await authService.signup(params);
      await loadProfile(); // New user has no registrations yet
    } catch (err: any) {
      setError(err?.message || "Signup failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    // Always clear local auth state — even if the server call fails — so a
    // signed-out session can never leak its user/role into the next login.
    try {
      setError(null);
      await authService.logout();
    } catch (err: any) {
      setError(err?.message || "Logout failed");
    } finally {
      setUser(null);
      setRegistrations([]);
      setLastRegisteredId(null);
    }
  }

  function clearError() {
    setError(null);
  }

  async function registerCompetition(
    compId: string,
    meta: Record<string, any> = {}
  ): Promise<Registration> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticStatus: RegistrationStatus = (meta.fee ?? 0) > 0 ? "pending_payment" : "pending_review";
    const reg: Registration = {
      id,
      compId,
      competitionName: meta.competitionName ?? "Unknown",
      fee: meta.fee ?? 0,
      status: optimisticStatus,
      createdAt: new Date().toISOString(),
      meta,
    };
    // Optimistic update first so UI responds immediately
    setRegistrations((s) => [reg, ...s]);
    setLastRegisteredId(compId);
    try {
      const { id: serverId, status: serverStatus } = await registrationsService.create({
        id,
        compId,
        meta,
      });
      // Use server status as source of truth
      const finalRegistration = {
        ...reg,
        id: serverId || id,
        status: serverStatus as RegistrationStatus,
      };
      setRegistrations((s) =>
        s.map((r) => (r.id === id ? finalRegistration : r))
      );
      return finalRegistration;
    } catch (err) {
      // Roll back optimistic update on failure
      setRegistrations((s) => s.filter((r) => r.id !== id));
      setLastRegisteredId(null);
      throw err;
    }
  }

  async function markRegistrationPaid(id: string) {
    setRegistrations((s) =>
      s.map((r) => (r.id === id ? { ...r, status: "paid" as const } : r))
    );
    try {
      await registrationsService.updateStatus(id, "paid");
    } catch {
      // Roll back
      setRegistrations((s) =>
        s.map((r) => (r.id === id ? { ...r, status: "registered" as const } : r))
      );
    }
  }

  async function removeRegistration(id: string) {
    const prev = registrations.find((r) => r.id === id);
    setRegistrations((s) => s.filter((r) => r.id !== id));
    try {
      await registrationsService.remove(id);
    } catch {
      // Roll back
      if (prev) setRegistrations((s) => [prev, ...s]);
    }
  }

  function clearLastRegistered() {
    setLastRegisteredId(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        isAuthenticated,
        login,
        signup,
        logout,
        clearError,
        fetchUser,
        registrations,
        registerCompetition,
        markRegistrationPaid,
        removeRegistration,
        lastRegisteredId,
        clearLastRegistered,
        setUser,
        refreshRegistrations: loadRegistrations,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Alias — import useUser from here instead of UserContext */
export const useUser = useAuth;

// ─── Helper ───────────────────────────────────────────────────────────────────

function mapProfile(data: any): AppUser {
  return {
    id: data.id,
    name: data.fullName || "",
    email: data.email || "",
    phone: data.phone || "",
    school: data.schoolName || data.school || "",
    level: data.grade as "SD" | "SMP" | "SMA" | undefined,
    city: data.city || "",
    role: (data.role as "student" | "parent" | "teacher") || "student",
    avatarUrl: data.photoUrl,
    subject: data.subject,
    childName: data.childName,
    childSchool: data.childSchool,
    childLevel: data.childGrade as "SD" | "SMP" | "SMA" | undefined,

    // ── Sprint 2: Enhanced profile fields ─────────────────────────────────────
    fullName: data.fullName,
    dateOfBirth: data.dateOfBirth,
    interests: data.interests,
    referralSource: data.referralSource,
    studentCardUrl: data.studentCardUrl,
    nisn: data.nisn,
    // School details
    schoolName: data.schoolName,
    npsn: data.npsn,
    schoolAddress: data.schoolAddress,
    schoolEmail: data.schoolEmail,
    schoolWhatsapp: data.schoolWhatsapp,
    schoolPhone: data.schoolPhone,
    // Supervisor details
    supervisorName: data.supervisorName,
    supervisorEmail: data.supervisorEmail,
    supervisorWhatsapp: data.supervisorWhatsapp,
    supervisorPhone: data.supervisorPhone,
    supervisorSchoolId: data.supervisorSchoolId,
    supervisorLinked: data.supervisorLinked,
    // Parent details
    parentName: data.parentName,
    parentOccupation: data.parentOccupation,
    parentWhatsapp: data.parentWhatsapp,
    parentPhone: data.parentPhone,
    parentSchoolId: data.parentSchoolId,
    parentLinked: data.parentLinked,
  };
}
