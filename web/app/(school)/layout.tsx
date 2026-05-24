'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Award,
  CalendarClock,
  ClipboardList,
  CreditCard,
  GraduationCap,
  LayoutGrid,
  Loader2,
  Trophy,
  Upload,
  Users,
} from 'lucide-react';
import { SchoolProvider, useSchool } from '@/lib/auth/school-context';
import { AppShell, type NavSection } from '@/components/shell/app-shell';
import { SelectSchoolModal } from '@/components/select-school-modal';

// School Admin: dashboard up top, then the two daily loops — Students
// (roster + bulk register/pay) and Registrations (status tracking) — then
// Reports.
const ADMIN_NAV: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/school-dashboard', icon: LayoutGrid, exact: true },
    ],
  },
  {
    label: 'Students',
    items: [
      { label: 'Student Roster', href: '/school-students', icon: Users },
      { label: 'Bulk Registration', href: '/bulk-registration', icon: Upload },
      { label: 'Bulk Payment', href: '/bulk-payment', icon: CreditCard },
    ],
  },
  {
    label: 'Registrations',
    items: [
      { label: 'All Registrations', href: '/school-registrations', icon: ClipboardList },
    ],
  },
  {
    label: 'Reports',
    items: [
      {
        label: 'Achievement PDF',
        href: '/api/schools/export/achievement.pdf',
        icon: Award,
        external: true,
      },
    ],
  },
];

// Teacher nav mirrors the dashboard quick-actions (Phase 4 added Bulk
// Registration / Bulk Payment / Achievement PDF) so every action surfaced
// on /school-dashboard is reachable from the left sidebar too. Grouped
// the same way as School Admin for muscle-memory consistency.
const TEACHER_NAV: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/school-dashboard', icon: LayoutGrid, exact: true },
    ],
  },
  {
    label: 'My Roster',
    items: [
      { label: 'My Students', href: '/school-my-students', icon: Users },
      { label: 'My Competitions', href: '/school-my-competitions', icon: Trophy },
      { label: 'Bulk Registration', href: '/bulk-registration', icon: Upload },
      { label: 'Bulk Payment', href: '/bulk-payment', icon: CreditCard },
    ],
  },
  {
    label: 'Track',
    items: [
      { label: 'Registrations', href: '/school-registrations', icon: ClipboardList },
      { label: 'Deadlines', href: '/school-deadline', icon: CalendarClock },
    ],
  },
  {
    label: 'Reports',
    items: [
      {
        label: 'Achievement PDF',
        href: '/api/teachers/export/achievement.pdf',
        icon: Award,
        external: true,
      },
    ],
  },
];

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  return (
    <SchoolProvider>
      <SchoolLayoutInner>{children}</SchoolLayoutInner>
    </SchoolProvider>
  );
}

function SchoolLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useSchool();
  const pathname = usePathname() ?? '';
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !pathname.includes('/school-signup')) {
      router.replace('/');
    }
  }, [user, loading, pathname, router]);

  // school-signup stays reachable unauthenticated — no shell.
  if (pathname.includes('/school-signup')) return <>{children}</>;

  // school_admin whose school isn't verified yet lands on /school-pending.
  // Teachers link to already-verified schools and skip approval.
  if (
    user?.role === 'school_admin' &&
    user.schoolVerificationStatus &&
    user.schoolVerificationStatus !== 'verified' &&
    !pathname.includes('/school-pending')
  ) {
    if (typeof window !== 'undefined') router.replace('/school-pending');
    return null;
  }
  // Unverified coordinator on /school-pending: render the pending page bare.
  if (pathname.includes('/school-pending')) return <>{children}</>;

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAdmin = user.role === 'school_admin';
  // Teachers + school_admins MUST have an associated school for any of
  // the school-scoped pages to function (roster, bulk reg, registrations
  // are all scoped by school_id). If they land without one, gate the
  // entire portal behind a blocking school-picker modal until they pick.
  const needsSchoolPick = !user.school_id;

  return (
    <AppShell
      brand={{ name: 'Competzy', tagline: isAdmin ? 'School Admin' : 'Teacher Portal', icon: GraduationCap }}
      nav={isAdmin ? ADMIN_NAV : TEACHER_NAV}
      user={{
        name: user.full_name || 'School',
        email: user.email,
        role: isAdmin ? 'School Admin' : 'Teacher',
      }}
      profileHref="/account/profile"
      onSignOut={async () => {
        await logout();
        router.replace('/');
      }}
    >
      {children}
      <SelectSchoolModal
        open={needsSchoolPick}
        onConfirmed={() => {
          // Hard nav re-runs the auth context's /auth/me hydration so the
          // new school_id is picked up and the modal naturally hides.
          window.location.assign(window.location.pathname);
        }}
      />
    </AppShell>
  );
}
