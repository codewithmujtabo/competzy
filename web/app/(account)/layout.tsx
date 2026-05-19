'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, User, FileText, Bell, LayoutGrid, Trophy } from 'lucide-react';
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

const NAV: NavSection[] = [
  {
    items: [
      { label: 'Profile', href: '/account/profile', icon: User },
      { label: 'Documents', href: '/account/documents', icon: FileText },
      { label: 'Notifications', href: '/account/notifications', icon: Bell },
      { label: 'My Competitions', href: '/account/competitions', icon: Trophy },
    ],
  },
  {
    label: 'Browse',
    items: [{ label: 'All competitions', href: '/competitions', icon: LayoutGrid }],
  },
];

function ShelledAccount({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useCompetitionAuth();
  const router = useRouter();

  // My Account is a student workspace — bounce everyone else home.
  const isStudent = user?.role === 'student';

  useEffect(() => {
    if (loading) return;
    if (!user || !isStudent) router.replace('/');
  }, [user, loading, isStudent, router]);

  if (loading || !user || !isStudent) {
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
      user={{
        name: user.fullName || user.full_name || 'Student',
        email: user.email,
        role: 'Participant',
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
