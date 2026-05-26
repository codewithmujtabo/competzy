'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  ClipboardList,
  Clock,
  Globe,
  GraduationCap,
  Layers,
  LayoutGrid,
  Library,
  Loader2,
  Mailbox,
  MapPin,
  Megaphone,
  MessageSquare,
  Package,
  School,
  Share2,
  ShoppingBag,
  Ticket,
  Trophy,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

import { useAuth } from '@/lib/auth/context';
import { AppShell, type NavSection } from '@/components/shell/app-shell';

// Information architecture:
//   Overview → daily landing
//   Competitions → manage what's running (incl. the question bank that
//     feeds them, and the venues those bank exams run at)
//   People → the audience side (schools, reps, users)
//   Commerce → revenue + storefront
//   Marketing → outbound + analytics on cross-sell
const NAV: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutGrid, exact: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Maintenance', href: '/admin/maintenance', icon: Wrench },
    ],
  },
  {
    label: 'Competitions',
    items: [
      { label: 'Competitions', href: '/admin/competitions', icon: Trophy },
      { label: 'Registrations', href: '/registrations', icon: ClipboardList },
      { label: 'Test Centers', href: '/venues', icon: MapPin },
      { label: 'Question Bank', href: '/question-bank', icon: Library },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Schools', href: '/schools', icon: School },
      { label: 'Pending Schools', href: '/schools-pending', icon: Clock },
      { label: 'Country Reps', href: '/country-reps', icon: Globe },
      { label: 'Users', href: '/users', icon: Users },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { label: 'Revenue', href: '/revenue', icon: Wallet },
      { label: 'Products', href: '/products', icon: Package },
      { label: 'Vouchers', href: '/vouchers', icon: Ticket },
      { label: 'Orders', href: '/orders', icon: ShoppingBag },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { label: 'Waitlist', href: '/admin/waitlist', icon: Mailbox },
      { label: 'Send Notification', href: '/notifications', icon: Megaphone },
      { label: 'Announcements', href: '/announcements', icon: Megaphone },
      { label: 'Materials', href: '/materials', icon: BookOpen },
      { label: 'Referrals', href: '/referrals', icon: Share2 },
      { label: 'Segments', href: '/segments', icon: Layers },
      { label: 'Suggestions', href: '/suggestions', icon: MessageSquare },
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
