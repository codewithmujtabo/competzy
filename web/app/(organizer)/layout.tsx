'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { GraduationCap, LayoutGrid, Library, Loader2, Trophy, Users, Wallet } from 'lucide-react';
import { OrganizerProvider, useOrganizer } from '@/lib/auth/organizer-context';
import { AppShell, type NavSection } from '@/components/shell/app-shell';

const NAV: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/organizer-dashboard', icon: LayoutGrid, exact: true },
      { label: 'Competitions', href: '/organizer-competitions', icon: Trophy },
      { label: 'Question Bank', href: '/question-bank', icon: Library },
      { label: 'Participants', href: '/participants', icon: Users },
      { label: 'Revenue', href: '/revenue', icon: Wallet },
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
      onSignOut={async () => {
        await logout();
        router.replace('/');
      }}
    >
      {children}
    </AppShell>
  );
}
