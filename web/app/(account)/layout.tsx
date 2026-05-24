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

function ShelledAccount({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useCompetitionAuth();
  const router = useRouter();

  // My Account is shared between students and parents (parents land on
  // the same catalog + can claim historical records / link family). Both
  // roles see the same sidebar; admin/operator roles bounce home.
  const isParticipant = user?.role === 'student' || user?.role === 'parent';

  useEffect(() => {
    if (loading) return;
    if (!user || !isParticipant) router.replace('/');
  }, [user, loading, isParticipant, router]);

  if (loading || !user || !isParticipant) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell
      brand={{ name: 'Competzy', tagline: 'My Account', icon: Trophy }}
      nav={NAV}
      notificationsHref="/account/notifications"
      profileHref="/account/profile"
      user={{
        name: user.fullName || user.full_name || (user.role === 'parent' ? 'Parent' : 'Student'),
        email: user.email,
        role: user.role === 'parent' ? 'Parent' : 'Participant',
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
