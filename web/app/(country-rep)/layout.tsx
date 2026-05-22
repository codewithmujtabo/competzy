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
import { AppShell, type NavSection } from '@/components/shell/app-shell';

const NAV: NavSection[] = [
  {
    items: [
      { label: 'Dashboard',         href: '/rep-portal',                   icon: LayoutGrid,    exact: true },
      { label: 'My Students',       href: '/rep-portal/students',          icon: Users },
      { label: 'Bulk Registration', href: '/rep-portal/bulk-registration', icon: Upload },
      { label: 'Bulk Payment',      href: '/rep-portal/bulk-payment',      icon: CreditCard },
      { label: 'Registrations',     href: '/rep-portal/registrations',     icon: ClipboardList },
      { label: 'Deadlines',         href: '/rep-portal/deadlines',         icon: CalendarClock },
    ],
  },
  {
    label: 'Reports',
    items: [{ label: 'Achievements', href: '/rep-portal/achievements', icon: Award }],
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
      onSignOut={async () => {
        await logout();
        router.replace('/');
      }}
    >
      {children}
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
