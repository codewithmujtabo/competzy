'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { competitionPaths } from '@/lib/competitions/registry';
import { AppShell } from '@/components/shell/app-shell';
import { STUDENT_NAV, STUDENT_BRAND } from '@/lib/nav/student-nav';
import { CompetitionTabs } from '@/components/competition/competition-tabs';

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

  // The sidebar is the SHARED global 5-item student nav — the same menu as the
  // catalog + account area — so it does NOT change when you enter a competition
  // (mentor ask #2). The competition's own features (Announcements, Materials,
  // Store, Certificates, Feedback) live in the in-page CompetitionTabs bar
  // under the header, scoped to this competition. Its brand stays Competzy; the
  // competition's identity shows in the page hero instead.
  return (
    <AppShell
      brand={STUDENT_BRAND}
      nav={STUDENT_NAV}
      notificationsHref="/account/notifications"
      profileHref="/account/profile"
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
      <CompetitionTabs slug={slug} />
      {children}
    </AppShell>
  );
}
