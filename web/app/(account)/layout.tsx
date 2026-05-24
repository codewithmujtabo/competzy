'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, User, FileText, Bell, Trophy, History, Users, LayoutGrid } from 'lucide-react';
import {
  CompetitionAuthProvider,
  useCompetitionAuth,
} from '@/lib/auth/competition-context';
import { AppShell, type NavSection } from '@/components/shell/app-shell';

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

// Browse first (it's the student's home/dashboard — what they land on
// after login). My Account underneath, ordered by how a student actually
// progresses: identity → joined comps → docs/records/family/notifications.
const NAV: NavSection[] = [
  {
    items: [
      { label: 'All Competitions', href: '/competitions', icon: LayoutGrid },
    ],
  },
  {
    label: 'My Account',
    items: [
      { label: 'Profile', href: '/account/profile', icon: User },
      { label: 'My Competitions', href: '/account/competitions', icon: Trophy },
      { label: 'Documents', href: '/account/documents', icon: FileText },
      { label: 'Records', href: '/account/records', icon: History },
      { label: 'Family', href: '/account/family', icon: Users },
      { label: 'Notifications', href: '/account/notifications', icon: Bell },
    ],
  },
];

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
    ? NAV
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
      brand={{ name: 'Competzy', tagline: 'Account Settings', icon: Trophy }}
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
