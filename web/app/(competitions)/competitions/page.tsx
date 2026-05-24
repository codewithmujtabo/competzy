'use client';

// Student dashboard at `/competitions` — landing page after login for
// students + parents. Hero (greeting + profile-completion ring), a 4-card
// KPI strip, a "Continue where you left off" CTA, the full competition
// catalog grid (favorites toggleable), and an achievements wall.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Heart,
  History,
  LayoutGrid,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { emcHttp } from '@/lib/api/client';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { getCompetitionConfig } from '@/lib/competitions/registry';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppShell, type NavSection } from '@/components/shell/app-shell';

// Sidebar nav shared with the (account) layout — Browse FIRST (this
// catalog IS the student/parent home) and My Account below. Duplication
// is intentional: the catalog is in the (competitions) route group so
// it stays reachable without the account guard, but students/parents
// land here and benefit from the same workspace shell.
const STUDENT_NAV: NavSection[] = [
  {
    items: [
      { label: 'All Competitions', href: '/competitions', icon: LayoutGrid },
    ],
  },
  {
    label: 'My Account',
    items: [
      { label: 'Profile', href: '/account/profile', icon: User },
      { label: 'My Competitions', href: '/account/competitions', icon: Trophy },
      { label: 'Documents', href: '/account/documents', icon: FileText },
      { label: 'Records', href: '/account/records', icon: History },
      { label: 'Family', href: '/account/family', icon: Users },
      { label: 'Notifications', href: '/account/notifications', icon: Bell },
    ],
  },
];

interface CatalogCompetition {
  id: string;
  slug: string | null;
  name: string;
  organizerName: string;
  category: string | null;
  gradeLevel: string | null;
  regCloseDate: string | null;
  competitionDate: string | null;
  /** Backend already filters non-international visitors out of this list (see
   *  competitions.routes.ts callerCountry()); the flag is surfaced here so the
   *  card can show an "International" badge for clarity. */
  isInternational?: boolean;
}

interface DashboardSummary {
  counts: { registrations: number; certificates: number; savedComps: number };
  bestScore: { value: number; compName: string; roundName: string | null } | null;
  continueTask: {
    type: 'pay' | 'exam';
    registrationId: string;
    slug: string | null;
    compName: string;
    label: string;
  } | null;
  recentCertificates: Array<{
    certificateNumber: string;
    type: string;
    awardLabel: string | null;
    issuedAt: string;
    verificationCode: string;
    competitionName: string;
    competitionSlug: string | null;
  }>;
}

interface MeProfile {
  fullName: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  dateOfBirth: string | null;
  supervisorName?: string | null;
  supervisorEmail?: string | null;
  schoolName?: string | null;
}

function fmtDate(d: string | null): string {
  return d
    ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
}

// The 9 profile fields the student should fill to be "complete" — matches
// Komodo's required_profile_fields. The ring is a soft progress signal — not
// an enforced gate (that lives server-side per-competition).
function profileCompletion(me: MeProfile | null): number {
  if (!me) return 0;
  const checks = [
    !!me.fullName?.trim(),
    !!me.phone?.trim(),
    !!me.city?.trim(),
    !!me.country?.trim(),
    !!me.dateOfBirth,
    !!me.supervisorName?.trim(),
    !!me.supervisorEmail?.trim(),
    !!me.schoolName?.trim(),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function CompletionRing({ percent }: { percent: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = c * (percent / 100);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,228,89,0.25)" strokeWidth="6" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="#FFE459"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform="rotate(-90 36 36)"
        className="transition-all duration-500"
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="14"
        fontWeight="700"
        fill="#FFE459"
      >
        {percent}%
      </text>
    </svg>
  );
}

function CompetitionCard({
  comp,
  isFav,
  onToggleFav,
}: {
  comp: CatalogCompetition;
  isFav: boolean;
  onToggleFav: (compId: string) => void;
}) {
  const hasPortal = comp.slug ? getCompetitionConfig(comp.slug) : null;
  const body = (
    <Card
      className={cn(
        'gap-0 p-6 transition-all duration-200',
        hasPortal
          ? 'hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/40 hover:shadow-lg'
          : 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Trophy className="size-5" />
        </div>
        <button
          type="button"
          aria-label={isFav ? 'Remove from saved' : 'Save competition'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFav(comp.id);
          }}
          className="rounded-full p-1 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/75"
        >
          <Heart className={cn('size-5', isFav && 'fill-primary text-primary')} />
        </button>
      </div>
      <h2 className="mt-4 font-serif text-lg font-medium leading-snug text-foreground">{comp.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{comp.organizerName}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {comp.isInternational && (
          <Badge className="font-normal bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-200">
            International
          </Badge>
        )}
        {comp.category && (
          <Badge variant="secondary" className="font-normal">{comp.category}</Badge>
        )}
        {comp.gradeLevel && (
          <Badge variant="outline" className="font-normal text-muted-foreground">{comp.gradeLevel}</Badge>
        )}
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="size-3.5" />
        <span>Registration closes {fmtDate(comp.regCloseDate)}</span>
      </div>
      <div className="mt-5 flex items-center justify-between">
        {hasPortal ? (
          <span className="flex items-center gap-1 text-sm font-medium text-primary">
            Open portal <ArrowRight className="size-4" />
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Portal coming soon</span>
        )}
      </div>
    </Card>
  );

  if (hasPortal && comp.slug) {
    // Send students straight to the dashboard — that view handles every state
    // (no registration, pending payment, missed, paid, etc.) in one place.
    return <Link href={`/competitions/${comp.slug}/dashboard`} className="block">{body}</Link>;
  }
  return body;
}

// One vibrant KPI tile with brand-palette gradient + paired ink color.
function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  gradient,
  ink,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Trophy;
  gradient: string;
  ink: string;
}) {
  return (
    <Card
      className={cn(
        'group relative gap-0 overflow-hidden border-0 p-5 transition-all duration-300 hover:-translate-y-0.5',
        gradient,
        ink,
      )}
    >
      <div className="relative flex items-start justify-between gap-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">{label}</p>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
          <Icon className="size-4" strokeWidth={2.25} />
        </span>
      </div>
      <p className="relative mt-4 font-serif text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="relative mt-1 text-xs opacity-80">{hint}</p>}
    </Card>
  );
}

export default function CompetitionCatalogPage() {
  const { user, loading: authLoading, logout } = useCompetitionAuth();
  const router = useRouter();

  const [comps, setComps] = useState<CatalogCompetition[] | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [me, setMe] = useState<MeProfile | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    emcHttp
      .get<CatalogCompetition[]>('/competitions')
      .then(setComps)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load competitions'));
    emcHttp
      .get<{ favorites: { id: string }[] }>('/favorites')
      .then((r) => setFavIds(new Set(r.favorites.map((f) => f.id))))
      .catch(() => {});
    // Dashboard summary + profile fetch only matter for students; harmless
    // for parents (the endpoints return empty / null values).
    if (user.role === 'student') {
      emcHttp
        .get<DashboardSummary>('/users/me/dashboard-summary')
        .then(setSummary)
        .catch(() => {});
      emcHttp.get<MeProfile>('/users/me').then(setMe).catch(() => {});
    }
  }, [user]);

  async function toggleFav(compId: string) {
    const wasFav = favIds.has(compId);
    setFavIds((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(compId);
      else next.add(compId);
      return next;
    });
    try {
      if (wasFav) await emcHttp.delete<{ message: string }>(`/favorites/${compId}`);
      else await emcHttp.post<{ message: string }>('/favorites', { compId });
      // Re-fetch the summary so the Saved KPI tile reflects the change.
      if (user?.role === 'student') {
        emcHttp.get<DashboardSummary>('/users/me/dashboard-summary').then(setSummary).catch(() => {});
      }
    } catch (e) {
      setFavIds((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(compId);
        else next.delete(compId);
        return next;
      });
      toast.error(e instanceof Error ? e.message : 'Could not update saved competitions');
    }
  }

  const completion = useMemo(() => profileCompletion(me), [me]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const signOut = async () => {
    await logout();
    router.replace('/');
  };

  const isStudent = user.role === 'student';
  const firstName = (user.fullName || user.full_name || 'there').split(' ')[0];

  // The interior of the page — same for student + non-student. The shell
  // changes around it (sidebar for students, lightweight header otherwise).
  const interior = (
    <div className="mx-auto max-w-6xl space-y-7 p-6 lg:p-10">
        {err && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {err}
          </div>
        )}

        {/* Hero — gradient greeting + profile completion ring (students only). */}
        <Card
          className={cn(
            'relative gap-0 overflow-hidden border-0 p-7 sm:p-9',
            'bg-gradient-to-br from-[#3D087B] via-[#6B1AB8] to-[#F43B86]',
            'shadow-[0_28px_70px_-30px_rgba(61,8,123,0.55)]',
          )}
        >
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-[#FFE459] opacity-30 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute -left-16 -bottom-24 size-64 rounded-full bg-[#F43B86] opacity-25 blur-3xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm ring-1 ring-white/25">
                <Sparkles className="size-3.5 text-[#FFE459]" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#FFE459]">
                  Welcome back
                </span>
              </div>
              <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#FFE459] sm:text-4xl">
                Hey {firstName}!
              </h1>
              <p className="mt-2 max-w-prose text-sm text-[#FFE459]/90">
                {summary?.continueTask
                  ? `${summary.continueTask.label} — pick up where you left off below.`
                  : 'Pick a competition to register or check on your progress.'}
              </p>
              {isStudent && me && completion < 100 && (
                <Link
                  href="/account/profile"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#FFE459]/90 underline-offset-4 hover:underline"
                >
                  Complete your profile <ArrowRight className="size-3" />
                </Link>
              )}
            </div>
            {isStudent && (
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm ring-1 ring-white/20">
                <CompletionRing percent={completion} />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FFE459]/80">
                    Profile
                  </p>
                  <p className="mt-1 font-serif text-lg font-semibold text-[#FFE459]">
                    {completion === 100 ? 'All set 🎉' : 'Almost there'}
                  </p>
                  <p className="text-xs text-[#FFE459]/80">{completion}% complete</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* KPI strip — student only. */}
        {isStudent && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              label="Registrations"
              value={summary?.counts.registrations ?? 0}
              hint={
                summary?.counts.registrations
                  ? `${summary.counts.registrations} competition${summary.counts.registrations === 1 ? '' : 's'} joined`
                  : 'Join your first competition'
              }
              icon={ClipboardCheck}
              gradient="bg-gradient-to-br from-[#3D087B] via-[#6B1AB8] to-[#1F0454]"
              ink="text-[#FFE459]"
            />
            <KpiTile
              label="Certificates"
              value={summary?.counts.certificates ?? 0}
              hint={
                summary?.counts.certificates
                  ? 'Earned & verified'
                  : 'Finish an exam to earn one'
              }
              icon={Award}
              gradient="bg-gradient-to-br from-[#F43B86] via-[#FF6BA8] to-[#8A1A6B]"
              ink="text-[#FFF4E8]"
            />
            <KpiTile
              label="Best score"
              value={summary?.bestScore ? summary.bestScore.value : '—'}
              hint={summary?.bestScore ? summary.bestScore.compName : 'Sit your first exam'}
              icon={Trophy}
              gradient="bg-gradient-to-br from-[#FFE459] via-[#FFD93D] to-[#FFC93C]"
              ink="text-[#11052C]"
            />
            <KpiTile
              label="Saved"
              value={summary?.counts.savedComps ?? favIds.size}
              hint="Competitions you bookmarked"
              icon={Heart}
              gradient="bg-gradient-to-br from-[#11052C] via-[#1F0454] to-[#3D087B]"
              ink="text-[#FFE459]"
            />
          </div>
        )}

        {/* Continue where you left off */}
        {isStudent && summary?.continueTask && (
          <Card className="flex flex-wrap items-center justify-between gap-3 overflow-hidden border-primary/30 bg-primary/5 p-5">
            <div className="flex min-w-0 flex-1 basis-[12rem] items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                {summary.continueTask.type === 'pay' ? <ClipboardCheck className="size-5" /> : <ShieldCheck className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary/80">
                  Continue where you left off
                </p>
                <p className="mt-0.5 truncate font-serif text-base font-medium text-foreground">
                  {summary.continueTask.label}
                </p>
              </div>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link
                href={
                  summary.continueTask.slug
                    ? `/competitions/${summary.continueTask.slug}/dashboard`
                    : '/competitions'
                }
              >
                Take me there <ArrowRight className="size-4" />
              </Link>
            </Button>
          </Card>
        )}

        {/* Catalog */}
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="font-serif text-xl font-semibold text-foreground">All competitions</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Tap one to learn more.</p>
            </div>
          </div>
          {!comps ? (
            <Card className="items-center gap-3 p-10 text-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading competitions…</p>
            </Card>
          ) : comps.length === 0 ? (
            <Card className="items-center gap-2 p-10 text-center">
              <Trophy className="size-7 text-muted-foreground" />
              <h2 className="font-serif text-lg font-medium text-foreground">No competitions yet</h2>
              <p className="text-sm text-muted-foreground">
                Competitions will appear here once an organizer publishes them.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {comps.map((c) => (
                <CompetitionCard
                  key={c.id}
                  comp={c}
                  isFav={favIds.has(c.id)}
                  onToggleFav={toggleFav}
                />
              ))}
            </div>
          )}
        </div>

        {/* Achievements wall */}
        {isStudent && summary && (
          <div>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground">Your achievements</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {summary.recentCertificates.length > 0
                    ? 'Recently earned — tap a certificate to verify.'
                    : 'Finish a competition exam to earn your first certificate.'}
                </p>
              </div>
            </div>
            {summary.recentCertificates.length === 0 ? (
              <Card className="items-center gap-2 p-10 text-center">
                <Award className="size-7 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No certificates yet — start a competition above.</p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {summary.recentCertificates.map((c) => (
                  <Card key={c.certificateNumber} className="gap-0 overflow-hidden p-0">
                    <div
                      className={cn(
                        'p-5',
                        c.type === 'achievement'
                          ? 'bg-gradient-to-br from-[#FFE459] via-[#FFD93D] to-[#FFC93C] text-[#11052C]'
                          : 'bg-gradient-to-br from-[#3D087B] via-[#6B1AB8] to-[#7A3FC4] text-[#FFE459]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
                          {c.type === 'achievement' ? (
                            <Trophy className="size-4" />
                          ) : (
                            <CheckCircle2 className="size-4" />
                          )}
                        </span>
                        <Badge variant="outline" className="border-current/30 bg-white/15 font-mono text-[10px] uppercase">
                          {c.type === 'achievement' ? 'Achievement' : 'Participation'}
                        </Badge>
                      </div>
                      <h3 className="mt-3 font-serif text-base font-semibold tracking-tight">
                        {c.competitionName}
                      </h3>
                      {c.awardLabel && (
                        <p className="mt-0.5 text-xs font-medium opacity-90">{c.awardLabel}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Certificate
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-foreground">
                          {c.certificateNumber}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Issued {fmtDate(c.issuedAt)}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <a href={`/verify/${c.verificationCode}`} target="_blank" rel="noreferrer">
                          Verify
                        </a>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
    </div>
  );

  // Both students and parents see the shared sidebar shell — they're both
  // catalog browsers + may have linked competitions/records. The user
  // dropdown in the top bar carries Profile + Sign out for either role.
  const isParent = user.role === 'parent';
  return (
    <AppShell
      brand={{ name: 'Competzy', tagline: 'My Account', icon: Trophy }}
      nav={STUDENT_NAV}
      notificationsHref="/account/notifications"
      profileHref="/account/profile"
      user={{
        name: user.fullName || user.full_name || (isParent ? 'Parent' : 'Student'),
        email: user.email,
        role: isParent ? 'Parent' : 'Participant',
      }}
      onSignOut={signOut}
    >
      {interior}
    </AppShell>
  );
}
