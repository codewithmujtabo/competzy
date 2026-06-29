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
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Globe,
  Heart,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { emcHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { getCompetitionConfig, competitionRegistry } from '@/lib/competitions/registry';
import { compStatusLabel, compStatusTone } from '@/lib/competitions/status';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AppShell } from '@/components/shell/app-shell';
import { STUDENT_NAV, STUDENT_BRAND } from '@/lib/nav/student-nav';

interface CatalogCompetition {
  id: string;
  slug: string | null;
  name: string;
  organizerName: string;
  category: string | null;
  gradeLevel: string | null;
  registrationStatus: string | null;
  regCloseDate: string | null;
  competitionDate: string | null;
  /** Backend already filters non-international visitors out of this list (see
   *  competitions.routes.ts callerCountry()); the flag is surfaced here so the
   *  card can show an "International" badge for clarity. */
  isInternational?: boolean;
  logoUrl?: string | null;
}

type GradeBand = 'elementary' | 'junior' | 'senior';
type LevelFilter = 'all' | 'national' | 'international';
type GradeFilter = 'all' | GradeBand;

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

// ── Per-competition colour identity ────────────────────────────────────────
// Known competitions reuse the SAME brand colours + logos as their portal hero
// / competzy.com (the registry gradient + the self-hosted /competitions/<slug>
// .webp logo). Operator-created competitions with no hand-tuned branding fall
// back to a stable, distinct hashed palette so every card is recognisable
// instead of a wall of white cards.

// Self-hosted logos in /public/competitions/<file>.webp (mirrored from
// competzy.com). Matched by keyword against the competition's slug + name,
// because operator-created slugs look like `international-greenwich-olympiad-f3i6d`.
const LOGO_MATCHERS: { file: string; test: RegExp }[] = [
  { file: 'komodo', test: /komodo/i },
  { file: 'owlypia', test: /owlypia/i },
  { file: 'genius', test: /genius/i },
  { file: 'igo', test: /\bigo\b|greenwich/i },
  { file: 'nextgen', test: /next\s*gen/i },
  { file: 'ispo', test: /\bispo\b/i },
  { file: 'osebi', test: /osebi/i },
  { file: 'emc', test: /\bemc\b/i },
];
function resolveLogo(comp: CatalogCompetition): string | null {
  const hay = `${comp.slug ?? ''} ${comp.name ?? ''}`;
  for (const m of LOGO_MATCHERS) if (m.test.test(hay)) return `/competitions/${m.file}.webp`;
  // An operator-uploaded absolute logo URL is the last resort.
  return comp.logoUrl && /^https?:\/\//i.test(comp.logoUrl) ? comp.logoUrl : null;
}

type Palette = { from: string; to: string; accent: string; glow: string; ink: 'light' | 'dark' };
const HASH_PALETTES: Palette[] = [
  { from: '#7C3AED', to: '#3D087B', accent: '#6B1AB8', glow: '#C084FC', ink: 'light' },
  { from: '#EC4899', to: '#9D174D', accent: '#BE185D', glow: '#FBCFE8', ink: 'light' },
  { from: '#F59E0B', to: '#B45309', accent: '#B45309', glow: '#FDE68A', ink: 'dark' },
  { from: '#10B981', to: '#065F46', accent: '#047857', glow: '#6EE7B7', ink: 'light' },
  { from: '#3B82F6', to: '#1E40AF', accent: '#1D4ED8', glow: '#93C5FD', ink: 'light' },
  { from: '#F43F5E', to: '#9F1239', accent: '#BE123C', glow: '#FDA4AF', ink: 'light' },
  { from: '#06B6D4', to: '#155E75', accent: '#0E7490', glow: '#67E8F9', ink: 'light' },
  { from: '#A855F7', to: '#6D28D9', accent: '#7E22CE', glow: '#D8B4FE', ink: 'light' },
];

type CardBrand = { from: string; to: string; accent: string; glow: string; ink: 'light' | 'dark'; logoSrc: string | null };
function brandFor(comp: CatalogCompetition): CardBrand {
  const reg = comp.slug ? competitionRegistry[comp.slug] : undefined;
  let from: string, to: string, accent: string, glow: string, ink: 'light' | 'dark';
  if (reg) {
    // Real brand gradient + accent — matches the competition's portal hero.
    [from, to] = reg.gradient;
    accent = reg.accent;
    glow = reg.activeAccent ?? reg.accent;
    ink = 'light';
  } else {
    const key = comp.id || comp.slug || comp.name || '';
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const p = HASH_PALETTES[h % HASH_PALETTES.length];
    from = p.from;
    to = p.to;
    accent = p.accent;
    glow = p.glow;
    ink = p.ink;
  }
  return { from, to, accent, glow, ink, logoSrc: resolveLogo(comp) };
}

// hex → rgba, for the soft brand wash painted over the (theme-aware) card body.
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Parse a comma/space-separated numeric grade string ("4,5,…,12") into the
// school-level bands it spans (Elementary 1–6 / Junior 7–9 / Senior 10–12).
function gradeBandsOf(gradeLevel: string | null): Set<GradeBand> {
  const bands = new Set<GradeBand>();
  if (!gradeLevel) return bands;
  for (const tok of gradeLevel.split(/[,\s]+/)) {
    const n = parseInt(tok, 10);
    if (!Number.isFinite(n)) continue;
    if (n >= 1 && n <= 6) bands.add('elementary');
    else if (n >= 7 && n <= 9) bands.add('junior');
    else if (n >= 10 && n <= 12) bands.add('senior');
  }
  return bands;
}

// A tidy "Grades 4–12" range instead of the raw comma list.
function gradeRange(gradeLevel: string | null): string | null {
  if (!gradeLevel) return null;
  const nums = gradeLevel
    .split(/[,\s]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const min = nums[0];
  const max = nums[nums.length - 1];
  return min === max ? `${min}` : `${min}–${max}`;
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
  const t = useT();
  const hasPortal = comp.slug ? getCompetitionConfig(comp.slug) : null;
  const brand = brandFor(comp);
  const bandFg = brand.ink === 'dark' ? '#1a1208' : '#ffffff';
  const range = gradeRange(comp.gradeLevel);
  const body = (
    <Card
      className={cn(
        'flex h-full flex-col gap-0 overflow-hidden border-0 bg-card p-0 shadow-sm ring-1 ring-black/5 transition-all duration-300 dark:ring-white/10',
        hasPortal ? 'hover:-translate-y-1 hover:shadow-xl' : 'opacity-70',
      )}
    >
      {/* Brand banner — gradient + dot texture + sheen + glow + faded logo
          watermark, so each competition reads like its own portal hero. */}
      <div
        className="relative h-28 shrink-0 overflow-hidden"
        style={{ backgroundImage: `linear-gradient(135deg, ${brand.from}, ${brand.to})`, color: bandFg }}
      >
        {/* dotted texture (inherits band ink via currentColor) */}
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1.4px)', backgroundSize: '15px 15px' }}
        />
        {/* diagonal sheen */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: 'linear-gradient(120deg, rgba(255,255,255,0.18), transparent 45%)' }}
        />
        {/* coloured glow + soft white glow for depth */}
        <span aria-hidden className="absolute -right-12 -top-14 size-44 rounded-full blur-2xl" style={{ backgroundColor: brand.glow, opacity: 0.45 }} />
        <span aria-hidden className="absolute -bottom-16 -left-12 size-40 rounded-full bg-white/15 blur-2xl" />
        {/* big faded logo watermark */}
        {brand.logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoSrc}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-3 top-1/2 size-36 -translate-y-1/2 object-contain opacity-20"
          />
        )}

        {/* Foreground: logo chip + save heart */}
        <div className="relative flex items-start justify-between p-4">
          <span
            className={cn(
              'flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5',
              brand.logoSrc ? 'bg-white p-2' : 'bg-white/20 ring-white/30 backdrop-blur-sm',
            )}
          >
            {brand.logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoSrc} alt="" className="size-full object-contain" />
            ) : (
              <Trophy className="size-6" />
            )}
          </span>
          <button
            type="button"
            aria-label={isFav ? 'Remove from saved' : 'Save competition'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFav(comp.id);
            }}
            className="flex size-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
          >
            <Heart className={cn('size-4', isFav ? 'fill-current' : 'opacity-90')} />
          </button>
        </div>

        {/* Category / level chips on the band */}
        {(comp.isInternational || comp.category) && (
          <div className="absolute bottom-3 left-4 flex flex-wrap items-center gap-1.5">
            {comp.isInternational && (
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-white/30 backdrop-blur-sm">
                {t('catalog.international')}
              </span>
            )}
            {comp.category && (
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-white/30 backdrop-blur-sm">
                {comp.category}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Body — soft brand wash + faded logo watermark so the whole card (not
          just the band) carries the competition's identity. flex-1 makes every
          card the same height; the footer is pinned to the bottom. */}
      <div className="relative flex flex-1 flex-col overflow-hidden p-5">
        {/* brand wash fading down the body */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `linear-gradient(180deg, ${hexA(brand.from, 0.1)}, ${hexA(brand.to, 0.03)} 60%, transparent)` }}
        />
        {/* faded logo watermark, bottom-right */}
        {brand.logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoSrc}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-5 -right-5 size-28 object-contain opacity-[0.07]"
          />
        )}

        <div className="relative">
          <h2 className="font-serif text-lg font-semibold leading-snug text-foreground">{comp.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{comp.organizerName}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {comp.registrationStatus && (
              <Badge
                variant="outline"
                className={cn('border-transparent font-medium', compStatusTone(comp.registrationStatus))}
              >
                {compStatusLabel(comp.registrationStatus, t)}
              </Badge>
            )}
            {range && (
              <Badge variant="outline" className="border-current/25 bg-background/60 font-normal" style={{ color: brand.accent }}>
                {t('catalog.gradesRange', { range })}
              </Badge>
            )}
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" style={{ color: brand.accent }} />
            <span>{t('catalog.registrationCloses', { date: fmtDate(comp.regCloseDate) })}</span>
          </div>
        </div>

        <div className="relative mt-auto flex items-center justify-between pt-5">
          {hasPortal ? (
            <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: brand.accent }}>
              Open portal <ArrowRight className="size-4" />
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t('catalog.portalComingSoon')}</span>
          )}
        </div>
      </div>
    </Card>
  );

  if (hasPortal && comp.slug) {
    // Send students straight to the dashboard — that view handles every state
    // (no registration, pending payment, missed, paid, etc.) in one place.
    return <Link href={`/competitions/${comp.slug}/dashboard`} className="block h-full">{body}</Link>;
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
  const t = useT();
  const { user, loading: authLoading, logout } = useCompetitionAuth();
  const router = useRouter();

  const [comps, setComps] = useState<CatalogCompetition[] | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [me, setMe] = useState<MeProfile | null>(null);

  // Catalog filters.
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [grade, setGrade] = useState<GradeFilter>('all');

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

  // Distinct categories present in the catalog (drives the Category pills).
  const categories = useMemo(() => {
    const set = new Set<string>();
    comps?.forEach((c) => {
      if (c.category?.trim()) set.add(c.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [comps]);

  const filtered = useMemo(() => {
    if (!comps) return null;
    const q = search.trim().toLowerCase();
    return comps.filter((c) => {
      if (q && !`${c.name} ${c.organizerName}`.toLowerCase().includes(q)) return false;
      if (level === 'international' && !c.isInternational) return false;
      if (level === 'national' && c.isInternational) return false;
      if (category !== 'all' && c.category?.trim() !== category) return false;
      if (grade !== 'all' && !gradeBandsOf(c.gradeLevel).has(grade)) return false;
      return true;
    });
  }, [comps, search, level, category, grade]);

  const filtersActive = search.trim() !== '' || level !== 'all' || category !== 'all' || grade !== 'all';
  const clearFilters = () => {
    setSearch('');
    setLevel('all');
    setCategory('all');
    setGrade('all');
  };

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
                  {t('catalog.welcomeBack')}
                </span>
              </div>
              <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#FFE459] sm:text-4xl">
                {t('catalog.greeting', { name: firstName })}
              </h1>
              <p className="mt-2 max-w-prose text-sm text-[#FFE459]/90">
                {summary?.continueTask
                  ? `${summary.continueTask.label} — pick up where you left off below.`
                  : t('catalog.subtitle')}
              </p>
              {isStudent && me && completion < 100 && (
                <Link
                  href="/account/profile"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#FFE459]/90 underline-offset-4 hover:underline"
                >
                  {t('catalog.completeProfile')} <ArrowRight className="size-3" />
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
                    {completion === 100 ? t('catalog.profileAllSet') : t('catalog.profileAlmost')}
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
              label={t('catalog.kpiRegistrations')}
              value={summary?.counts.registrations ?? 0}
              hint={t('catalog.kpiRegistrationsHint')}
              icon={ClipboardCheck}
              gradient="bg-gradient-to-br from-[#3D087B] via-[#6B1AB8] to-[#1F0454]"
              ink="text-[#FFE459]"
            />
            <KpiTile
              label={t('catalog.kpiCertificates')}
              value={summary?.counts.certificates ?? 0}
              hint={t('catalog.kpiCertificatesHint')}
              icon={Award}
              gradient="bg-gradient-to-br from-[#F43B86] via-[#FF6BA8] to-[#8A1A6B]"
              ink="text-[#FFF4E8]"
            />
            <KpiTile
              label={t('catalog.kpiBestScore')}
              value={summary?.bestScore ? summary.bestScore.value : '—'}
              hint={summary?.bestScore ? summary.bestScore.compName : t('catalog.kpiBestScoreHint')}
              icon={Trophy}
              gradient="bg-gradient-to-br from-[#FFE459] via-[#FFD93D] to-[#FFC93C]"
              ink="text-[#11052C]"
            />
            <KpiTile
              label={t('catalog.kpiSaved')}
              value={summary?.counts.savedComps ?? favIds.size}
              hint={t('catalog.kpiSavedHint')}
              icon={Heart}
              gradient="bg-gradient-to-br from-[#11052C] via-[#1F0454] to-[#3D087B]"
              ink="text-[#FFE459]"
            />
          </div>
        )}

        {/* Continue where you left off */}
        {isStudent && summary?.continueTask && (
          <Card className="flex-row flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
              {summary.continueTask.type === 'pay' ? <ClipboardCheck className="size-5" /> : <ShieldCheck className="size-5" />}
            </span>
            <div className="min-w-0 flex-1 basis-[14rem]">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-primary/70">
                {t('catalog.continueTitle')}
              </p>
              <p className="mt-0.5 truncate text-base font-semibold leading-snug text-foreground">
                {summary.continueTask.label}
              </p>
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
              <h2 className="font-serif text-xl font-semibold text-foreground">{t('catalog.allCompetitions')}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{t('catalog.allCompetitionsHint')}</p>
            </div>
          </div>
          {!comps ? (
            <Card className="items-center gap-3 p-10 text-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('catalog.loading')}</p>
            </Card>
          ) : comps.length === 0 ? (
            <Card className="items-center gap-2 p-10 text-center">
              <Trophy className="size-7 text-muted-foreground" />
              <h2 className="font-serif text-lg font-medium text-foreground">{t('catalog.empty')}</h2>
              <p className="text-sm text-muted-foreground">{t('catalog.emptyHint')}</p>
            </Card>
          ) : (
            <>
              {!!me?.country &&
                me.country.toUpperCase() !== 'ID' &&
                comps.some((c) => c.isInternational) && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
                    <Globe className="size-4 shrink-0 text-primary" />
                    {t('catalog.intlHint')}
                  </div>
                )}

              {/* Filter bar — search + Level / Category / Grade dropdowns, inline. */}
              <Card className="mb-4 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[12rem] flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('catalog.searchPlaceholder')}
                      className="pl-9"
                      aria-label={t('catalog.searchPlaceholder')}
                    />
                  </div>

                  <Select value={level} onValueChange={(v) => setLevel(v as LevelFilter)}>
                    <SelectTrigger className="w-[150px]" aria-label={t('catalog.filterLevel')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('catalog.levelAll')}</SelectItem>
                      <SelectItem value="national">{t('catalog.levelNational')}</SelectItem>
                      <SelectItem value="international">{t('catalog.levelInternational')}</SelectItem>
                    </SelectContent>
                  </Select>

                  {categories.length > 0 && (
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="w-[160px]" aria-label={t('catalog.filterCategory')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('catalog.categoryAll')}</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Select value={grade} onValueChange={(v) => setGrade(v as GradeFilter)}>
                    <SelectTrigger className="w-[150px]" aria-label={t('catalog.filterGrade')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('catalog.gradeAll')}</SelectItem>
                      <SelectItem value="elementary">{t('catalog.gradeElementary')}</SelectItem>
                      <SelectItem value="junior">{t('catalog.gradeJunior')}</SelectItem>
                      <SelectItem value="senior">{t('catalog.gradeSenior')}</SelectItem>
                    </SelectContent>
                  </Select>

                  {filtersActive && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                      {t('catalog.clearFilters')}
                    </button>
                  )}
                  <p className="ml-auto text-xs text-muted-foreground">
                    {t('catalog.resultsCount', { n: String(filtered?.length ?? 0), total: String(comps.length) })}
                  </p>
                </div>
              </Card>

              {filtered && filtered.length === 0 ? (
                <Card className="items-center gap-3 p-10 text-center">
                  <Trophy className="size-7 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('catalog.noMatches')}</p>
                  {filtersActive && (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      {t('catalog.clearFilters')}
                    </Button>
                  )}
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filtered!.map((c) => (
                    <CompetitionCard
                      key={c.id}
                      comp={c}
                      isFav={favIds.has(c.id)}
                      onToggleFav={toggleFav}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Achievements wall */}
        {isStudent && summary && (
          <div>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground">{t('catalog.achievementsTitle')}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {summary.recentCertificates.length > 0
                    ? t('catalog.achievementsHint')
                    : 'Finish a competition exam to earn your first certificate.'}
                </p>
              </div>
            </div>
            {summary.recentCertificates.length === 0 ? (
              <Card className="items-center gap-2 p-10 text-center">
                <Award className="size-7 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t('catalog.achievementsEmpty')}</p>
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
      brand={STUDENT_BRAND}
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
