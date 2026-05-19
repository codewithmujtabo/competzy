'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useParams, useRouter } from 'next/navigation';
import {
  Loader2,
  LayoutGrid,
  Megaphone,
  BookOpen,
  ShoppingBag,
  Award,
  MessageSquare,
  Trophy,
} from 'lucide-react';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { AppShell, type NavSection } from '@/components/shell/app-shell';

// Route sections that render WITHOUT the student shell: `register` is
// unauthenticated (its own split-screen auth), `admin` is the operator view
// (its own guard), `exam` is the full-screen exam player.
const SHELL_EXEMPT = new Set(['register', 'admin', 'exam']);

/**
 * Shared layout for the per-competition student portal. Authenticated student
 * pages (dashboard, announcements, materials, store, certificates, feedback)
 * render inside a left-sidebar `AppShell` — the same chrome as the operator
 * portals. Exempt sections fall through untouched.
 */
export default function CompetitionSlugLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  // pathname is /competitions/<slug>/<section>/… — the section drives exemption.
  const section = pathname.split('/')[3] ?? '';

  if (SHELL_EXEMPT.has(section)) return <>{children}</>;
  return <ShelledCompetition slug={slug}>{children}</ShelledCompetition>;
}

function ShelledCompetition({ slug, children }: { slug: string; children: ReactNode }) {
  const { user, loading, logout } = useCompetitionAuth();
  const router = useRouter();
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(paths.login);
    else if (user.role === 'admin') router.replace(paths.admin);
  }, [user, loading, router, paths.login, paths.admin]);

  if (loading || !user || user.role === 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const nav: NavSection[] = [
    {
      items: [
        { label: 'Dashboard', href: paths.dashboard, icon: LayoutGrid },
        { label: 'Announcements', href: paths.announcements, icon: Megaphone },
        { label: 'Materials', href: paths.materials, icon: BookOpen },
        { label: 'Store', href: paths.store, icon: ShoppingBag },
        { label: 'Certificates', href: paths.certificate, icon: Award },
        { label: 'Feedback', href: paths.feedback, icon: MessageSquare },
      ],
    },
  ];

  return (
    <AppShell
      brand={{ name: config.shortName, tagline: config.wordmark, icon: Trophy }}
      nav={nav}
      user={{
        name: user.fullName || user.full_name || 'Student',
        email: user.email,
        role: 'Participant',
      }}
      onSignOut={async () => {
        await logout();
        router.replace(paths.login);
      }}
    >
      {children}
    </AppShell>
  );
}
