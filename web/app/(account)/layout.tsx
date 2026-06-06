'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trophy, LayoutGrid } from 'lucide-react';
import {
  CompetitionAuthProvider,
  useCompetitionAuth,
} from '@/lib/auth/competition-context';
import { AppShell } from '@/components/shell/app-shell';
import { STUDENT_NAV, STUDENT_BRAND } from '@/lib/nav/student-nav';

/**
 * The global "My Account" workspace — the student's account-wide pages
 * (profile, documents, notifications, records, …). It lives outside the
 * per-competition portal because this data is account-wide, not tied to one
 * competition. The slug-agnostic competition auth context is reused; the
 * area itself is gated to students.
 *
 * Nav grows phase by phase — each My Account feature adds its own item.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <CompetitionAuthProvider>
      <ShelledAccount>{children}</ShelledAccount>
    </CompetitionAuthProvider>
  );
}

// The student/parent sidebar is the SHARED 5-item nav (see lib/nav/student-nav)
// so the menu is identical here, on the catalog, and inside a competition.

// Roles whose post-login destination IS the My Account workspace
// (students + parents). For everyone else, /account/profile is the
// "Account Settings" stop they can hit from the top-bar dropdown, but
// the side-nav (Browse / My Account) is irrelevant — they don't live
// here, they live in their own portal. So we render a slimmer shell
// without the My Account nav for non-participants.
const PARTICIPANT_ROLES = new Set(['student', 'parent']);

// Per-role pre-login home — where to send the user when their session
// has expired and we need to drop them off the account workspace.
function homeForRole(role?: string): string {
  switch (role) {
    case 'admin': return '/dashboard';
    case 'organizer': return '/organizer-dashboard';
    case 'school_admin':
    case 'teacher': return '/school-dashboard';
    case 'country_representative': return '/rep-portal';
    default: return '/';
  }
}

function ShelledAccount({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useCompetitionAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isParticipant = PARTICIPANT_ROLES.has(user.role);
  // Operators (admin/organizer/school_admin/teacher/country_rep) visiting
  // /account/profile from their portal's dropdown get the full sidebar
  // BACK TO their own portal home — they don't need the Browse + My
  // Account items, just an exit door.
  const operatorNav = isParticipant
    ? STUDENT_NAV
    : [
        {
          items: [
            {
              label: 'Back to portal',
              href: homeForRole(user.role),
              icon: LayoutGrid,
            },
          ],
        },
      ];

  return (
    <AppShell
      brand={isParticipant ? STUDENT_BRAND : { name: 'Competzy', tagline: 'Account Settings', taglineKey: 'shell.tagAccountSettings', icon: Trophy }}
      nav={operatorNav}
      notificationsHref={isParticipant ? '/account/notifications' : undefined}
      profileHref="/account/profile"
      user={{
        name:
          user.fullName ||
          user.full_name ||
          (user.role === 'parent' ? 'Parent' : user.role === 'student' ? 'Student' : 'User'),
        email: user.email,
        role:
          user.role === 'parent'
            ? 'Parent'
            : user.role === 'student'
              ? 'Participant'
              : user.role
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase()),
      }}
      onSignOut={async () => {
        await logout();
        router.replace('/');
      }}
    >
      {children}
    </AppShell>
  );
}
