'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Globe,
  LayoutGrid,
  Loader2,
  Upload,
  Users,
} from 'lucide-react';

import { CountryRepAuthProvider, useCountryRepAuth } from '@/lib/auth/country-rep-context';
import { RepProvider } from '@/lib/rep/context';
import { AppShell, type NavSection } from '@/components/shell/app-shell';

// Rep nav mirrors the school-admin shape (Dashboard → My Roster →
// Track → Reports) since the workflow is identical, just scoped to a
// country instead of a school.
const NAV: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', labelKey: 'opnav.dashboard', href: '/rep-portal', icon: LayoutGrid, exact: true },
    ],
  },
  {
    label: 'My Roster',
    labelKey: 'opnav.myRoster',
    items: [
      { label: 'My Students', labelKey: 'opnav.myStudents', href: '/rep-portal/students', icon: Users },
      { label: 'Bulk Registration', labelKey: 'opnav.bulkRegistration', href: '/rep-portal/bulk-registration', icon: Upload },
      { label: 'Bulk Payment', labelKey: 'opnav.bulkPayment', href: '/rep-portal/bulk-payment', icon: CreditCard },
    ],
  },
  {
    label: 'Track',
    labelKey: 'opnav.track',
    items: [
      { label: 'Registrations', labelKey: 'opnav.registrations', href: '/rep-portal/registrations', icon: ClipboardList },
      { label: 'Deadlines', labelKey: 'opnav.deadlines', href: '/rep-portal/deadlines', icon: CalendarClock },
    ],
  },
  {
    label: 'Reports',
    labelKey: 'opnav.reports',
    items: [{ label: 'Achievements', labelKey: 'opnav.achievements', href: '/rep-portal/achievements', icon: Award }],
  },
];

function RepShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useCountryRepAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <AppShell
      brand={{ name: 'Competzy', tagline: 'Country Representative', icon: Globe }}
      nav={NAV}
      user={{
        name: user.fullName || user.full_name || 'Representative',
        email: user.email,
        role: 'Country Representative',
      }}
      profileHref="/account/profile"
      onSignOut={async () => {
        await logout();
        router.replace('/');
      }}
    >
      <RepProvider>{children}</RepProvider>
    </AppShell>
  );
}

export default function CountryRepLayout({ children }: { children: ReactNode }) {
  return (
    <CountryRepAuthProvider>
      <RepShell>{children}</RepShell>
    </CountryRepAuthProvider>
  );
}
