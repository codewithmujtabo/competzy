'use client';

// Public competition landing page reached from the /competitions catalog
// (catalog cards link here, not to /dashboard, so students see a welcoming
// detail page first instead of getting dropped straight into the register
// / payment flow). Renders a hero image + welcome + competition details
// (incl. the fee — first place price is revealed), then a Register CTA.
//
// Routing rules:
// - Not signed in → Register CTA → /competitions/[slug]/register (signup).
// - Signed in, no registration yet → Register CTA → POST /registrations
//   then /competitions/[slug]/dashboard (step-flow handles missing data + pay).
// - Signed in and already registered → silent redirect to /dashboard
//   so the student doesn't see "Register" twice.

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  GraduationCap,
  Loader2,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';

import { emcHttp } from '@/lib/api/client';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LandingCompetition {
  id: string;
  slug: string | null;
  name: string;
  organizerName: string;
  category: string | null;
  gradeLevel: string | null;
  fee: number;
  regOpenDate: string | null;
  regCloseDate: string | null;
  competitionDate: string | null;
  description: string | null;
  imageUrl: string | null;
  logoUrl: string | null;
  kind: 'native' | 'affiliated';
  registrationStatus: 'On Going' | 'Closed' | 'Coming Soon' | null;
}

interface RegistrationRow {
  id: string;
  compId: string;
  status: string;
}

function fmtDate(d: string | null): string {
  return d
    ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
}

function rupiah(n: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}

export default function CompetitionLandingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const router = useRouter();
  const paths = useMemo(() => competitionPaths(slug), [slug]);

  const { user, loading: authLoading } = useCompetitionAuth();

  const [comp, setComp] = useState<LandingCompetition | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  // null while we haven't checked yet; false once we've confirmed the user
  // has no live registration; true while we redirect.
  const [redirecting, setRedirecting] = useState<boolean | null>(null);

  // Surface a 404 for slugs we have no portal config for. The registry is the
  // source of truth — even competitions in the DB without a registry entry
  // get notFound() to keep the URL space stable.
  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  // Fetch the competition by slug. Uses the public list endpoint with a
  // slug= filter (already supported) — no auth required, so the landing
  // page works for visitors too.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    emcHttp
      .get<LandingCompetition[]>(`/competitions?slug=${encodeURIComponent(slug)}`)
      .then((rows) => {
        if (cancelled) return;
        setComp(rows[0] ?? null);
        if (!rows[0]) setLoadErr('Competition not found');
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadErr(e instanceof Error ? e.message : 'Failed to load competition');
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // If the student is already enrolled, take them straight to the dashboard.
  // Only checks when both the user and the comp are loaded; visitors and
  // unenrolled students just see the landing page.
  useEffect(() => {
    if (authLoading || !user || !comp) return;
    if (redirecting !== null) return;
    emcHttp
      .get<RegistrationRow[]>('/registrations')
      .then((rows) => {
        const hit = rows.find((r) => r.compId === comp.id);
        if (hit) {
          setRedirecting(true);
          router.replace(paths.dashboard);
        } else {
          setRedirecting(false);
        }
      })
      .catch(() => setRedirecting(false));
  }, [authLoading, user, comp, redirecting, paths.dashboard, router]);

  // Register CTA — branches on auth state. New visitor goes through the
  // signup page (which auto-enrolls). Signed-in student calls /registrations
  // directly and lands on the dashboard step-flow.
  const onRegister = async () => {
    if (!comp) return;
    if (!user) {
      router.push(paths.register);
      return;
    }
    setEnrolling(true);
    try {
      await emcHttp.post('/registrations', {
        id: crypto.randomUUID(),
        compId: comp.id,
      });
      router.replace(paths.dashboard);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not enroll. Please try again.';
      // "Already registered" is a race with the redirect effect; route to
      // dashboard instead of surfacing a scary error.
      if (/already (exists|registered)/i.test(msg)) {
        router.replace(paths.dashboard);
        return;
      }
      toast.error(msg);
      setEnrolling(false);
    }
  };

  // Skeleton while either auth resolves OR the comp fetch is in flight, AND
  // while we're confirming whether to redirect an already-enrolled student.
  // The combined gate keeps a half-rendered "Register" CTA from flashing
  // for a student we're about to redirect away.
  if (!comp || (user && redirecting === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        {loadErr ? (
          <div className="max-w-md rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadErr}
          </div>
        ) : (
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  // Registration window — disable the Register CTA when the comp is closed
  // or its registration window has elapsed. Coming Soon stays clickable so
  // a student can still queue up an account.
  const closedByDate = comp.regCloseDate ? new Date(comp.regCloseDate) < new Date() : false;
  const closed = comp.registrationStatus === 'Closed' || closedByDate;

  const ctaLabel = !user
    ? 'Register now'
    : enrolling
      ? 'Enrolling…'
      : closed
        ? 'Registration closed'
        : 'Register now';

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — subtle, keeps the brand wordmark + a back-to-catalog escape
          hatch for students who clicked through and want to keep browsing. */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3 lg:px-10">
          <Link href="/competitions" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight className="size-4 rotate-180" />
            All competitions
          </Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Competzy</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8 lg:px-10 lg:py-12">
        {/* Hero — image at top with a soft gradient wash, then the wordmark
            and organizer. Falls back to a brand gradient if no image set. */}
        <Card className="gap-0 overflow-hidden border-0 p-0">
          <div className="relative h-56 w-full bg-gradient-to-br from-[#3D087B] via-[#6B1AB8] to-[#F43B86] sm:h-72">
            {comp.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={comp.imageUrl}
                alt={comp.name}
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Trophy className="size-16 text-white/40" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-6 sm:p-8">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/85">
                  {comp.organizerName}
                </p>
                <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight text-white sm:text-4xl">
                  {comp.name}
                </h1>
              </div>
              {comp.registrationStatus && (
                <Badge
                  variant="outline"
                  className="border-white/30 bg-white/15 font-mono text-[10px] uppercase text-white backdrop-blur"
                >
                  {comp.registrationStatus}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {/* Welcome — short, warm, single paragraph. Falls back to a sensible
            default if the organizer hasn't filled in a description. */}
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
            <Sparkles className="size-3.5 text-primary" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              Welcome
            </span>
          </div>
          <p className="text-base leading-relaxed text-foreground/90">
            {comp.description
              ? comp.description
              : `Welcome to ${comp.name}. Read through the details below, then tap Register when you're ready to join.`}
          </p>
        </section>

        {/* Details — category / grade / dates / fee. First place the price
            is actually revealed in the student journey (catalog hides it). */}
        <section>
          <h2 className="font-serif text-lg font-semibold text-foreground">Competition details</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <DetailRow
              icon={Trophy}
              label="Category"
              value={comp.category ?? '—'}
            />
            <DetailRow
              icon={GraduationCap}
              label="Grade level"
              value={comp.gradeLevel ?? '—'}
            />
            <DetailRow
              icon={CalendarDays}
              label="Registration closes"
              value={fmtDate(comp.regCloseDate)}
            />
            <DetailRow
              icon={CalendarDays}
              label="Competition date"
              value={fmtDate(comp.competitionDate)}
            />
            <DetailRow
              icon={Sparkles}
              label="Registration fee"
              value={comp.fee === 0 ? 'Free' : rupiah(comp.fee)}
              emphasized
            />
          </div>
        </section>

        {/* Register CTA — sticky-ish footer card. Disabled when the window
            has closed; nudges visitors to sign in if they're not logged in. */}
        <Card className="flex flex-col gap-4 border-primary/30 bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              Ready to compete?
            </p>
            <p className="mt-1 text-sm text-foreground">
              {user
                ? 'You’ll be guided through the rest — fill in any missing details, then pay.'
                : 'Create your free Competzy account to register, or sign in if you already have one.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!user && (
              <Button asChild variant="outline" size="lg">
                <Link href="/">Sign in</Link>
              </Button>
            )}
            <Button onClick={onRegister} disabled={enrolling || closed} size="lg">
              {ctaLabel}
              {!closed && !enrolling && <ArrowRight className="ml-1.5 size-4" />}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  emphasized,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <Card className="flex flex-row items-center gap-3 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p
          className={
            emphasized
              ? 'mt-0.5 font-serif text-lg font-semibold text-foreground'
              : 'mt-0.5 text-sm text-foreground'
          }
        >
          {value}
        </p>
      </div>
    </Card>
  );
}
