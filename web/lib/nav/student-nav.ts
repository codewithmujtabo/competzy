import type { LucideIcon } from 'lucide-react';
import { Award, LayoutGrid, Megaphone, Trophy, User } from 'lucide-react';
import type { NavSection } from '@/components/shell/app-shell';

/**
 * Sidebar brand for every student/parent surface — always Competzy, never
 * swapped to a competition's brand. A competition's identity (EMC tricolor,
 * Komodo purple, …) lives in the page hero instead, so the global menu stays
 * constant even after you enter a competition.
 */
export const STUDENT_BRAND: { name: string; tagline: string; icon: LucideIcon } = {
  name: 'Competzy',
  tagline: 'My Account',
  icon: Trophy,
};

/**
 * The single, simplified 5-link student/parent navigation — the ONE shared
 * menu used identically by the catalog (`/competitions`), the global account
 * area (`/account/*`), AND inside a competition portal. Because all three pass
 * this same array to `AppShell`, the sidebar never changes when you enter a
 * competition.
 *
 * Intentionally 5 items. The rest are reachable elsewhere, not the sidebar:
 *  - Documents / Records / Family → tabs under Profile.
 *  - Notifications → the top-bar bell.
 *  - Per-competition features (Materials, Store, Feedback, …) → tabs inside
 *    the competition page.
 */
export const STUDENT_NAV: NavSection[] = [
  {
    items: [
      { label: 'All Competitions', href: '/competitions', icon: LayoutGrid, exact: true },
    ],
  },
  {
    label: 'My Account',
    items: [
      {
        label: 'Profile',
        href: '/account/profile',
        icon: User,
        // Documents/Records/Family are tabs of Profile — keep Profile lit there.
        activePrefixes: ['/account/documents', '/account/records', '/account/family'],
      },
      {
        label: 'My Competitions',
        href: '/account/competitions',
        icon: Trophy,
        // Stay lit while viewing a specific competition portal.
        activePrefixes: ['/competitions/'],
      },
      { label: 'My Achievements', href: '/account/achievements', icon: Award },
      { label: 'Announcements', href: '/account/announcements', icon: Megaphone },
    ],
  },
];
