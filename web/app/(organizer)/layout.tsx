'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { GraduationCap, LayoutGrid, Library, Loader2, Trophy, Users } from 'lucide-react';
import { OrganizerProvider, useOrganizer } from '@/lib/auth/organizer-context';
import { AppShell, type NavSection } from '@/components/shell/app-shell';

// Organizers spend their day in three loops: see what's happening
// (dashboard), curate competitions + their question bank (content), and
// triage participant approvals (people). Revenue analytics moved to the
// admin portal — organizers care about it via the dashboard KPIs only.
const NAV: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', labelKey: 'opnav.dashboard', href: '/organizer-dashboard', icon: LayoutGrid, exact: true },
    ],
  },
  {
    label: 'Workspace',
    labelKey: 'opnav.workspace',
    items: [
      { label: 'My Competitions', labelKey: 'opnav.myCompetitions', href: '/organizer-competitions', icon: Trophy },
      { label: 'Participants', labelKey: 'opnav.participants', href: '/participants', icon: Users },
      { label: 'Question Bank', labelKey: 'opnav.questionBank', href: '/question-bank', icon: Library },
    ],
  },
];

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrganizerProvider>
      <OrganizerLayoutInner>{children}</OrganizerLayoutInner>
    </OrganizerProvider>
  );
}

function OrganizerLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useOrganizer();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, pathname, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell
      brand={{ name: 'Competzy', tagline: 'Organizer Portal', icon: GraduationCap }}
      nav={NAV}
      user={{ name: user.full_name || 'Organizer', email: user.email, role: 'Organizer' }}
      profileHref="/account/profile"
      onSignOut={async () => {
        await logout();
        router.replace('/');
      }}
    >
      {children}
    </AppShell>
  );
}
