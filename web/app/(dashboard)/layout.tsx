'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  Clock,
  GraduationCap,
  Layers,
  LayoutGrid,
  Library,
  Loader2,
  MapPin,
  Megaphone,
  School,
  Trophy,
  Users,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/context';
import { AppShell, type NavSection } from '@/components/shell/app-shell';

const NAV: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutGrid, exact: true },
      { label: 'Registrations', href: '/registrations', icon: ClipboardList },
      { label: 'Competitions', href: '/admin/competitions', icon: Trophy },
      { label: 'Question Bank', href: '/question-bank', icon: Library },
      { label: 'Venues', href: '/venues', icon: MapPin },
      { label: 'Segments', href: '/segments', icon: Layers },
      { label: 'Send Notification', href: '/notifications', icon: Megaphone },
    ],
  },
  {
    label: 'Schools & Users',
    items: [
      { label: 'Pending Schools', href: '/schools-pending', icon: Clock },
      { label: 'Schools', href: '/schools', icon: School },
      { label: 'Users', href: '/users', icon: Users },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
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
      brand={{ name: 'Competzy', tagline: 'Admin Panel', icon: GraduationCap }}
      nav={NAV}
      user={{ name: user.full_name || 'Admin', email: user.email, role: 'Administrator' }}
      onSignOut={async () => {
        await logout();
        router.replace('/');
      }}
    >
      {children}
    </AppShell>
  );
}
