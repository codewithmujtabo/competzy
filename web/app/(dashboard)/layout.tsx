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
      { label: 'Dashboard', labelKey: 'opnav.dashboard', href: '/dashboard', icon: LayoutGrid, exact: true },
    ],
  },
  {
    label: 'Competitions',
    labelKey: 'opnav.competitions',
    items: [
      { label: 'Competitions', labelKey: 'opnav.competitions', href: '/admin/competitions', icon: Trophy },
      { label: 'Registrations', labelKey: 'opnav.registrations', href: '/registrations', icon: ClipboardList },
      { label: 'Test Centers', labelKey: 'opnav.testCenters', href: '/venues', icon: MapPin },
      { label: 'Question Bank', labelKey: 'opnav.questionBank', href: '/question-bank', icon: Library },
    ],
  },
  {
    label: 'People',
    labelKey: 'opnav.people',
    items: [
      { label: 'Schools', labelKey: 'opnav.schools', href: '/schools', icon: School },
      { label: 'Approvals', labelKey: 'opnav.approvals', href: '/pending-approvals', icon: Clock },
      { label: 'Country Reps', labelKey: 'opnav.countryReps', href: '/country-reps', icon: Globe },
      { label: 'Users', labelKey: 'opnav.users', href: '/users', icon: Users },
    ],
  },
  {
    label: 'Commerce',
    labelKey: 'opnav.commerce',
    items: [
      { label: 'Revenue', labelKey: 'opnav.revenue', href: '/revenue', icon: Wallet },
      { label: 'Products', labelKey: 'opnav.products', href: '/products', icon: Package },
      { label: 'Vouchers', labelKey: 'opnav.vouchers', href: '/vouchers', icon: Ticket },
      { label: 'Orders', labelKey: 'opnav.orders', href: '/orders', icon: ShoppingBag },
    ],
  },
  {
    label: 'Marketing',
    labelKey: 'opnav.marketing',
    items: [
      { label: 'Waitlist', labelKey: 'opnav.waitlist', href: '/admin/waitlist', icon: Mailbox },
      { label: 'Send Notification', labelKey: 'opnav.sendNotification', href: '/notifications', icon: Megaphone },
      { label: 'Announcements', labelKey: 'opnav.announcements', href: '/announcements', icon: Megaphone },
      { label: 'Materials', labelKey: 'opnav.materials', href: '/materials', icon: BookOpen },
      { label: 'Referrals', labelKey: 'opnav.referrals', href: '/referrals', icon: Share2 },
      { label: 'Segments', labelKey: 'opnav.segments', href: '/segments', icon: Layers },
      { label: 'Suggestions', labelKey: 'opnav.suggestions', href: '/suggestions', icon: MessageSquare },
    ],
  },
  {
    label: 'Operations',
    labelKey: 'opnav.operations',
    items: [
      { label: 'Maintenance', labelKey: 'opnav.maintenance', href: '/admin/maintenance', icon: Wrench },
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
      brand={{ name: 'Competzy', tagline: 'Admin Panel', taglineKey: 'shell.tagAdmin', icon: GraduationCap }}
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
