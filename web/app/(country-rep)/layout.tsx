'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Loader2, Users } from 'lucide-react';

import { CountryRepAuthProvider, useCountryRepAuth } from '@/lib/auth/country-rep-context';
import { AppShell, type NavSection } from '@/components/shell/app-shell';

const NAV: NavSection[] = [
  {
    items: [{ label: 'My Students', href: '/rep-portal', icon: Users, exact: true }],
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
