'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Zap,
} from 'lucide-react';
import { emcHttp, HttpError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { useT, useLocale } from '@/lib/i18n/context';
import type { MessageKey } from '@/lib/i18n/messages/en';
import { pickText } from '@/lib/i18n/pick-text';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import {
  getCompetitionConfig,
  competitionPaths,
  type CompetitionPortalConfig,
} from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ProfileCompletionDialog,
  type ProfileFieldKey,
} from '@/components/profile/profile-completion-dialog';
import { CreatureCard, type CreatureRow } from '@/components/profile/creature-card';
import { RegistrationFormDialog } from '@/components/competition/registration-form-dialog';

interface RegistrationRow {
  id: string;
  compId: string;
  roundId: string | null;
  status: string;
  score: number | null;
  isMedalist: boolean | null;
  registrationNumber: string | null;
}

function rupiah(n: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}

// rgba() from a #rrggbb hex + alpha — for tinted accent backgrounds/rings.
function hexA(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Per-competition presentation theme derived from the registry config — the
// single source of truth for the dashboard's accent colours. Mirrors the
// mockup's two-accent system:
//   • `fill`       — the highlight BACKGROUND (lime for Komodo, orange for EMC,
//                    the registry accent otherwise); paired with `fillInk` for
//                    readable text/icons on top (lime needs dark ink).
//   • `structural` — borders, section text, active-card outline, progress bars
//                    (purple for Komodo, blue for EMC, the accent otherwise).
// `done` stays green across all competitions.
interface CompTheme {
  fill: string;
  fillInk: string;
  structural: string;
  structuralSoft: string;
  done: string;
  panelGradient: string;
  heroStyle: 'tricolor' | 'komodo' | 'gradient';
}

const DONE_GREEN = '#16A34A';

function compTheme(config: CompetitionPortalConfig): CompTheme {
  const done = DONE_GREEN;
  if (config.heroStyle === 'tricolor') {
    // EMC — orange fill (white ink), blue structural.
    return {
      fill: '#FF6B00',
      fillInk: '#ffffff',
      structural: '#1B6EF3',
      structuralSoft: hexA('#1B6EF3', 0.1),
      done,
      panelGradient: 'linear-gradient(160deg, #0D47C4 0%, #1B6EF3 100%)',
      heroStyle: 'tricolor',
    };
  }
  if (config.heroStyle === 'komodo') {
    // Komodo — lime fill (dark ink), violet structural, deep-purple panel.
    return {
      fill: '#B8FF00',
      fillInk: '#1A0880',
      structural: '#5627FF',
      structuralSoft: hexA('#5627FF', 0.1),
      done,
      panelGradient: 'linear-gradient(160deg, #1A0880 0%, #5627FF 100%)',
      heroStyle: 'komodo',
    };
  }
  const a = config.activeAccent ?? config.accent;
  return {
    fill: a,
    fillInk: '#ffffff',
    structural: a,
    structuralSoft: hexA(a, 0.1),
    done,
    panelGradient: `linear-gradient(160deg, ${config.gradient[0]} 0%, ${config.gradient[1]} 100%)`,
    heroStyle: config.heroStyle ?? 'gradient',
  };
}

type StepStatus = 'done' | 'current' | 'upcoming';
type CheckType = 'profile' | 'documents' | 'payment' | 'approval' | 'none';

interface FlowProgressStep {
  id: string;
  stepOrder: number;
  stepKey: string;
  title: string;
  /** Bahasa Indonesia translations (Phase 4) — null = render the canonical value. */
  titleId: string | null;
  description: string | null;
  descriptionId: string | null;
  checkType: CheckType;
  status: StepStatus;
  startsOn: string | null;
  endsOn: string | null;
  location: string | null;
  locationId: string | null;
}

// "25 May – 30 Sep 2026" / "10 Oct 2026" / "" — the schedule label for a stage.
function stageDateLabel(startsOn: string | null, endsOn: string | null): string {
  const f = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  if (startsOn && endsOn) return `${f(startsOn)} – ${f(endsOn)}`;
  return startsOn ? f(startsOn) : endsOn ? f(endsOn) : '';
}

interface FlowProgress {
  registrationId: string;
  registrationStatus: string;
  isReady: boolean;
  steps: FlowProgressStep[];
}

// Affiliated-competition access — the issued login + the external site URL.
interface AffiliatedCredential {
  registrationId: string;
  username: string;
  password: string;
  issuedAt: string;
}

interface AccessInfo {
  externalUrl: string | null;
  credential: AffiliatedCredential | null;
}

// Fallback copy for competitions that have no configured step-flow.
const STATUS_COPY: Record<string, { title: string; body: string }> = {
  pending_payment: {
    title: 'Your seat is held.',
    body: 'Complete your payment to lock in your spot.',
  },
  pending_review: {
    title: 'Awaiting admin review.',
    body: 'We’re reviewing your registration. You’ll be notified by email.',
  },
  registered: {
    title: 'You’re registered.',
    body: 'Materials and your test-center details will arrive closer to the date.',
  },
  paid: {
    title: 'You’re in.',
    body: 'Payment confirmed. Materials and test-center details will follow.',
  },
  rejected: {
    title: 'Registration declined.',
    body: 'Please contact support if you believe this is in error.',
  },
};

// Guidance shown under the step the participant is currently on.
function currentHint(checkType: CheckType, t: ReturnType<typeof useT>): string {
  switch (checkType) {
    case 'profile':
      return t('dashboard.hintProfile');
    case 'documents':
      return t('dashboard.hintDocuments');
    case 'payment':
      return t('dashboard.hintPayment');
    case 'approval':
      return t('dashboard.hintApproval');
    case 'none':
      return '';
  }
}

function StepNode({
  status,
  order,
  theme,
}: {
  status: StepStatus;
  order: number;
  theme: CompTheme;
}) {
  if (status === 'done') {
    return (
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: theme.done }}
      >
        <Check className="size-4" />
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{ background: theme.fill, color: theme.fillInk, boxShadow: `0 0 0 5px ${hexA(theme.fill, 0.2)}` }}
      >
        {order}
      </span>
    );
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm text-muted-foreground">
      {order}
    </span>
  );
}

function AccessBlock({
  externalUrl,
  credential,
}: {
  externalUrl: string | null;
  credential: AffiliatedCredential | null;
}) {
  return (
    <div className="mt-2 rounded-md border bg-card p-3">
      {credential ? (
        <>
          <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-xs">
            <dt className="text-muted-foreground">Username</dt>
            <dd className="break-all font-mono text-foreground">{credential.username}</dd>
            <dt className="text-muted-foreground">Password</dt>
            <dd className="break-all font-mono text-foreground">{credential.password}</dd>
          </dl>
          {externalUrl && (
            <Button asChild size="sm" className="mt-3">
              <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                Open the competition platform
              </a>
            </Button>
          )}
        </>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your access details are being prepared — check back soon.
        </p>
      )}
    </div>
  );
}

// A native-competition exam offered to the student — drives the "exam" step.
interface AvailableExam {
  examId: string;
  name: string;
  code: string;
  windowStatus: 'unscheduled' | 'upcoming' | 'open' | 'closed';
  session: { id: string; state: 'in_progress' | 'finished' } | null;
}

function ExamBlock({ compId, slug }: { compId: string | null; slug: string }) {
  const router = useRouter();
  const [exams, setExams] = useState<AvailableExam[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!compId) {
      setExams([]);
      return;
    }
    emcHttp
      .get<AvailableExam[]>(`/exams/available?compId=${encodeURIComponent(compId)}`)
      .then(setExams)
      .catch(() => setExams([]));
  }, [compId]);

  const start = async (examId: string) => {
    setBusy(examId);
    try {
      const r = await emcHttp.post<{ sessionId: string }>(`/exams/${examId}/sessions`, {});
      router.push(`/competitions/${slug}/exam/${r.sessionId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start the exam');
      setBusy(null);
    }
  };

  if (exams === null) {
    return (
      <div className="mt-2 rounded-md border bg-card p-3 text-xs text-muted-foreground">
        Loading exams…
      </div>
    );
  }
  if (exams.length === 0) {
    return (
      <div className="mt-2 rounded-md border bg-card p-3 text-xs text-muted-foreground">
        No exam is available for you yet — check back closer to the exam date.
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-2">
      {exams.map((ex) => {
        const sess = ex.session;
        return (
          <div key={ex.examId} className="rounded-md border bg-card p-3">
            <p className="text-sm font-medium text-foreground">{ex.name}</p>
            {sess?.state === 'finished' ? (
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href={`/competitions/${slug}/exam/${sess.id}/result`}>View your result</Link>
              </Button>
            ) : sess?.state === 'in_progress' ? (
              <Button asChild size="sm" className="mt-2">
                <Link href={`/competitions/${slug}/exam/${sess.id}`}>Resume exam</Link>
              </Button>
            ) : ex.windowStatus === 'open' ? (
              <Button
                size="sm"
                className="mt-2"
                disabled={busy === ex.examId}
                onClick={() => start(ex.examId)}
              >
                {busy === ex.examId ? 'Starting…' : 'Start exam'}
              </Button>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {ex.windowStatus === 'upcoming'
                  ? 'This exam has not opened yet.'
                  : ex.windowStatus === 'closed'
                    ? 'This exam has closed.'
                    : 'This exam is not scheduled yet.'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// The student's certificate(s) for this competition — drives the "results" step.
interface MyCertificate {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  type: string;
  awardLabel: string | null;
  revokedAt: string | null;
}

function CertificateBlock({ compId }: { compId: string | null }) {
  const [certs, setCerts] = useState<MyCertificate[] | null>(null);

  useEffect(() => {
    if (!compId) {
      setCerts([]);
      return;
    }
    emcHttp
      .get<MyCertificate[]>(`/certificates/mine?compId=${encodeURIComponent(compId)}`)
      .then(setCerts)
      .catch(() => setCerts([]));
  }, [compId]);

  if (certs === null) {
    return (
      <div className="mt-2 rounded-md border bg-card p-3 text-xs text-muted-foreground">
        Loading your certificate…
      </div>
    );
  }
  if (certs.length === 0) {
    return (
      <div className="mt-2 rounded-md border bg-card p-3 text-xs text-muted-foreground">
        Your certificate will appear here once you’ve completed an exam.
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-2">
      {certs.map((c) => (
        <div key={c.id} className="rounded-md border bg-card p-3">
          <p className="text-sm font-medium text-foreground">
            {c.type === 'achievement'
              ? 'Certificate of Achievement'
              : 'Certificate of Participation'}
            {c.awardLabel && <span className="text-primary"> · {c.awardLabel}</span>}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {c.certificateNumber}
            {c.revokedAt && <span className="text-destructive"> · revoked</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a
                href={`/api/certificates/verify/${c.verificationCode}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download certificate
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/verify/${c.verificationCode}`}>Verify</Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// A round of a multi-round competition (from GET /competitions/:id).
interface Round {
  id: string;
  roundName: string;
  roundType: string;
  roundCategory: string;
  examDate: string | null;
  registrationDeadline: string | null;
  fee: number;
  /** Optional international price in USD — Stripe-eligible when set + > 0. */
  feeInternational: number | null;
  location: string | null;
  gating: { mode?: string; rule?: string; requiresRoundId?: string } | null;
  isActive: boolean;
  /** Long-form round details the operator types into the rounds builder. */
  description: string | null;
}

function usd(n: number): string {
  // Show no fractional cents for whole-dollar amounts, two decimals otherwise.
  const fixed = Number.isInteger(n) ? n.toString() : n.toFixed(2);
  return `$${fixed} USD`;
}

// A student is "international" iff their profile carries a country that isn't
// Indonesia. Treat missing/blank as local (Indonesia is the default audience
// and the only one with a live Midtrans flow).
function isInternationalStudent(country: string | null | undefined): boolean {
  if (!country) return false;
  return country.toUpperCase() !== 'ID';
}

const CATEGORY_LABEL: Record<string, string> = {
  fast_track: 'Fast Track',
  local: 'Local Round',
  global: 'Global Round',
};

const PACKAGES = [
  { value: 'one_day', label: 'One-day trip' },
  { value: 'three_day', label: '3-day trip' },
];

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'paid' || status === 'approved' || status === 'completed'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
      : status === 'rejected'
        ? 'bg-destructive/10 text-destructive'
        : 'bg-primary/10 text-primary';
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${tone}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function hasMedal(regs: RegistrationRow[]): boolean {
  return regs.some((r) => r.isMedalist === true);
}

type RoundState =
  | { kind: 'registered' }
  | { kind: 'missed' }
  | { kind: 'locked'; note: string }
  | { kind: 'open' };

// Decide what a student sees for a round — registered / missed (window closed) /
// locked (gating unmet) / open. The backend is authoritative on registration;
// this drives the panel's display.
function roundState(
  round: Round,
  reg: RegistrationRow | undefined,
  regs: RegistrationRow[],
  rounds: Round[],
): RoundState {
  if (reg) return { kind: 'registered' };
  if (
    round.registrationDeadline &&
    new Date(round.registrationDeadline).getTime() < Date.now()
  ) {
    return { kind: 'missed' };
  }
  const mode = round.gating?.mode;
  if (mode === 'prerequisite') {
    const prereq = rounds.find((r) => r.id === round.gating?.requiresRoundId);
    const prereqReg = prereq ? regs.find((r) => r.roundId === prereq.id) : undefined;
    const rule = round.gating?.rule ?? 'completed';
    const ok =
      rule === 'registered'
        ? !!prereqReg && prereqReg.status !== 'rejected'
        : rule === 'paid'
          ? !!prereqReg &&
            ['paid', 'pending_review', 'approved', 'submitted', 'completed'].includes(
              prereqReg.status,
            )
          : prereqReg?.status === 'completed';
    return ok
      ? { kind: 'open' }
      : {
          kind: 'locked',
          note: `Opens once you ${
            rule === 'registered' ? 'register for' : rule === 'paid' ? 'pay for' : 'complete'
          } ${prereq?.roundName ?? 'an earlier round'}.`,
        };
  }
  if (mode === 'qualified') {
    return hasMedal(regs)
      ? { kind: 'open' }
      : { kind: 'locked', note: 'Opens once you earn a qualifying score in a round.' };
  }
  if (mode === 'unqualified') {
    return hasMedal(regs)
      ? { kind: 'locked', note: "You've already qualified — the Fast Track isn't needed." }
      : { kind: 'open' };
  }
  return { kind: 'open' };
}

// The Global Round needs a couple of extra inputs before registering.
function GlobalRoundDialog({
  round,
  registering,
  onClose,
  onConfirm,
}: {
  round: Round | null;
  registering: string | null;
  onClose: () => void;
  onConfirm: (meta: Record<string, unknown>) => void;
}) {
  const [participantType, setParticipantType] = useState<'local' | 'international'>('local');
  const [pkg, setPkg] = useState('one_day');

  return (
    <Dialog open={!!round} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{round?.roundName ?? 'Global Round'}</DialogTitle>
          <DialogDescription>
            A few details before you register for the Grand Final.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Participant type</p>
            <div className="flex gap-2">
              {(['local', 'international'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setParticipantType(t)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    participantType === t
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input hover:bg-accent'
                  }`}
                >
                  {t === 'local' ? 'Local (Indonesian)' : 'International'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Trip package</p>
            <div className="flex gap-2">
              {PACKAGES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPkg(p.value)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    pkg === p.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input hover:bg-accent'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!!round && registering === round.id}
            onClick={() => onConfirm({ participantType, package: pkg })}
          >
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The per-round registration panel for a multi-round competition — register
// and pay for each round independently; missed and locked rounds are shown.
function RoundsPanel({
  rounds,
  regs,
  slug,
  wordmark,
  registering,
  onRegister,
  userCountry,
}: {
  rounds: Round[];
  regs: RegistrationRow[];
  slug: string;
  wordmark: string;
  registering: string | null;
  onRegister: (roundId: string, meta?: Record<string, unknown>) => void;
  userCountry: string | null;
}) {
  const t = useT();
  const byRound = new Map(regs.filter((r) => r.roundId).map((r) => [r.roundId, r]));
  const [globalRound, setGlobalRound] = useState<Round | null>(null);
  const intl = isInternationalStudent(userCountry);

  // Helper — pick the price string to show for a round given the caller's
  // country. Returns null for free rounds.
  const priceFor = (round: Round): string | null => {
    if (intl && round.feeInternational != null && round.feeInternational > 0) {
      return usd(round.feeInternational);
    }
    if (round.fee > 0) return rupiah(round.fee);
    return null;
  };

  return (
    // overflow-hidden + min-w-0 — the rounds-card grid items can default to
    // min-width:auto in CSS grid, which lets long titles or the offline-payment
    // paragraph push the whole row past the viewport on mobile. Containing it
    // here keeps the panel inside its column.
    <Card className="gap-0 overflow-hidden p-5 sm:p-7">
      <h2 className="font-serif text-xl font-medium text-foreground">
        {t('dashboard.competitionRounds')}
      </h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        {t('dashboard.roundsSubtitle', { name: wordmark })}
      </p>
      {/* Vertical list — one full-width row per round so the round name never
          truncates and there's room for the description, gating notes, and
          a stacked status + CTA column on the right edge. */}
      <ul className="space-y-3">
        {rounds.map((round, i) => {
          const reg = byRound.get(round.id);
          const state = roundState(round, reg, regs, rounds);
          const categoryLabel = CATEGORY_LABEL[round.roundCategory];
          const price = priceFor(round);
          const examDate = round.examDate
            ? new Date(round.examDate).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : null;
          const deadline = round.registrationDeadline
            ? new Date(round.registrationDeadline).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : null;
          // International students pay the round's USD price via the same
          // Midtrans flow — Stripe isn't onboardable for an Indonesian
          // merchant, so the charge is in IDR (their card issuer handles the
          // local-currency conversion at point of sale). When no USD price is
          // configured for the round we keep the offline-organizer copy.
          const intlEligible = intl && (round.feeInternational ?? 0) > 0;

          return (
            <li
              key={round.id}
              className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-start sm:gap-6"
            >
              {/* LEFT — title, badges, full description, metadata. */}
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-base font-semibold text-foreground">
                    {round.roundName || `Round ${i + 1}`}
                  </h4>
                  {categoryLabel && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      {categoryLabel}
                    </span>
                  )}
                  {round.location && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      {round.location}
                    </span>
                  )}
                </div>

                {round.description && (
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {round.description}
                  </p>
                )}

                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex gap-1.5">
                    <dt className="font-mono uppercase tracking-wide text-[10px]">{t('dashboard.mode')}</dt>
                    <dd className="text-foreground">{round.roundType}</dd>
                  </div>
                  {examDate && (
                    <div className="flex gap-1.5">
                      <dt className="font-mono uppercase tracking-wide text-[10px]">{t('dashboard.exam')}</dt>
                      <dd className="text-foreground">{examDate}</dd>
                    </div>
                  )}
                  {deadline && !reg && state.kind !== 'missed' && (
                    <div className="flex gap-1.5">
                      <dt className="font-mono uppercase tracking-wide text-[10px]">{t('dashboard.closes')}</dt>
                      <dd className="text-foreground">{deadline}</dd>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <dt className="font-mono uppercase tracking-wide text-[10px]">{t('dashboard.fee')}</dt>
                    <dd className="text-foreground">{price ?? t('dashboard.free')}</dd>
                  </div>
                </dl>
              </div>

              {/* RIGHT — status pill + CTA, stacked. Fixed-ish width so the
                  buttons line up vertically across the list. */}
              <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-56 sm:items-end">
                {reg ? (
                  <StatusPill status={reg.status} />
                ) : state.kind === 'missed' ? (
                  <span className="self-start rounded-full bg-muted px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground sm:self-end">
                    {t('dashboard.missed')}
                  </span>
                ) : null}

                {reg ? (
                  reg.status === 'pending_payment' ? (
                    // International students pay via the same Midtrans flow — the
                    // pay page computes the right amount (the round's USD price
                    // converted to IDR when set, else the local IDR fee), so we
                    // always route to it rather than dead-ending anyone.
                    <Button size="sm" asChild className="w-full sm:w-auto">
                      <Link href={`${competitionPaths(slug).pay}?registrationId=${reg.id}`}>
                        {intlEligible
                          ? t('dashboard.pay', { amount: usd(round.feeInternational ?? 0) })
                          : t('dashboard.payRoundFee')}
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground sm:text-right">
                      {STATUS_COPY[reg.status]?.body ?? `Status: ${reg.status.replace(/_/g, ' ')}`}
                    </p>
                  )
                ) : state.kind === 'missed' ? (
                  <p className="text-xs text-muted-foreground sm:text-right">
                    {t('dashboard.missedNote')}
                  </p>
                ) : state.kind === 'locked' ? (
                  <p className="text-xs text-muted-foreground sm:text-right">{state.note}</p>
                ) : (
                  <Button
                    size="sm"
                    disabled={registering === round.id}
                    className="w-full sm:w-auto"
                    onClick={() =>
                      round.roundCategory === 'global'
                        ? setGlobalRound(round)
                        : onRegister(round.id)
                    }
                  >
                    {registering === round.id ? t('dashboard.registering') : t('dashboard.registerRound')}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <GlobalRoundDialog
        round={globalRound}
        registering={registering}
        onClose={() => setGlobalRound(null)}
        onConfirm={(meta) => {
          if (globalRound) onRegister(globalRound.id, meta);
          setGlobalRound(null);
        }}
      />
    </Card>
  );
}

// Status badge per timeline stage (mockup parity). Active uses the
// competition accent (orange for EMC) so it reads as "act now".
function StepBadge({ status, theme }: { status: StepStatus; theme: CompTheme }) {
  const t = useT();
  if (status === 'done') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <CheckCircle2 className="size-3" />
        {t('dashboard.badgeDone')}
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        style={{ background: theme.fill, color: theme.fillInk }}
      >
        <AlertCircle className="size-3" />
        {t('dashboard.badgeActionNeeded')}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Clock className="size-3" />
      {t('dashboard.badgeUpcoming')}
    </span>
  );
}

function Stepper({
  steps,
  externalUrl,
  credential,
  compId,
  slug,
  theme,
  onCompleteProfile,
}: {
  steps: FlowProgressStep[];
  externalUrl: string | null;
  credential: AffiliatedCredential | null;
  compId: string | null;
  slug: string;
  theme: CompTheme;
  onCompleteProfile: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  return (
    <ol className="mt-1">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const hint = s.status === 'current' ? currentHint(s.checkType, t) : '';
        const showAccess = s.stepKey === 'external_access' && s.status !== 'upcoming';
        const showExam =
          (s.stepKey === 'exam' || s.stepKey.startsWith('round')) && s.status !== 'upcoming';
        const showCert = s.stepKey === 'results' || s.stepKey === 'announcement';
        const showPay = s.checkType === 'payment' && s.status === 'current';
        const showProfile = s.checkType === 'profile' && s.status === 'current';
        const showDocs = s.checkType === 'documents' && s.status === 'current';
        // The mockup's "Pendaftaran" stage carries BOTH a fill-the-form action
        // and a pay action — our flow has one check_type per step, so the
        // registration stage surfaces the form button explicitly by step key.
        const showRegForm = s.stepKey === 'registration' && s.status === 'current';
        return (
          <li key={s.id} className="flex gap-4">
            <div className="flex flex-col items-center pt-1">
              <StepNode status={s.status} order={s.stepOrder} theme={theme} />
              {!last && (
                <span
                  className="w-px flex-1"
                  style={{ background: s.status === 'done' ? theme.done : 'var(--border)' }}
                />
              )}
            </div>
            <div className={cn('flex-1', !last && 'pb-5')}>
              <div
                className={cn(s.status === 'current' && 'rounded-xl border p-4 shadow-sm')}
                style={
                  s.status === 'current'
                    ? { borderColor: theme.structural, background: hexA(theme.structural, 0.04) }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={cn(
                      'text-sm',
                      s.status === 'upcoming' ? 'text-muted-foreground' : 'font-semibold text-foreground',
                    )}
                  >
                    {pickText(s.title, s.titleId, locale)}
                  </p>
                  <StepBadge status={s.status} theme={theme} />
                </div>
                {(s.startsOn || s.endsOn || s.location) && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5 shrink-0" />
                    <span>
                      {[stageDateLabel(s.startsOn, s.endsOn), pickText(s.location, s.locationId, locale)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </p>
                )}
                {s.status !== 'upcoming' && s.description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {pickText(s.description, s.descriptionId, locale)}
                  </p>
                )}
                {hint && (
                  <p
                    className="mt-2 rounded-md px-3 py-2 text-xs leading-relaxed"
                    style={{ background: hexA(theme.structural, 0.06), color: theme.structural }}
                  >
                    {hint}
                  </p>
                )}
                {showAccess && <AccessBlock externalUrl={externalUrl} credential={credential} />}
                {showExam && <ExamBlock compId={compId} slug={slug} />}
                {showCert && <CertificateBlock compId={compId} />}
                {(showRegForm || showPay) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {showRegForm && (
                      <Button size="sm" onClick={onCompleteProfile}>
                        {t('dashboard.fillRegForm')}
                      </Button>
                    )}
                    {showPay && (
                      <Button asChild size="sm" variant={showRegForm ? 'outline' : 'default'}>
                        <Link href={competitionPaths(slug).pay}>{t('dashboard.payRegistrationFee')}</Link>
                      </Button>
                    )}
                  </div>
                )}
                {showProfile && (
                  <Button size="sm" className="mt-3" onClick={onCompleteProfile}>
                    {t('dashboard.completeRegForm')}
                  </Button>
                )}
                {showDocs && (
                  <Button asChild size="sm" className="mt-3">
                    <Link href="/account/documents">{t('dashboard.uploadDocuments')}</Link>
                  </Button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Branded competition hero (Phase 3 — mockup parity) ────────────────────
// EMC gets the white tricolor + math-watermark treatment from the mockup;
// every other competition gets a clean accent-gradient hero from its registry
// config. The sidebar stays Competzy-branded — the competition's identity
// lives HERE, in the page hero, not in the chrome.
const EMC_TRI = { blue: '#1B6EF3', pink: '#E91E8C', orange: '#FF6B00' };

function HeroStats({
  stats,
  light,
}: {
  stats: { k: string; v: string; color?: string }[];
  light?: boolean;
}) {
  return (
    <div
      className={cn(
        'mt-6 flex flex-wrap gap-y-4 border-t pt-4',
        light ? 'border-white/20' : 'border-border',
      )}
    >
      {stats.map((s, i) => (
        <div
          key={s.k}
          className={cn(
            'pr-6',
            i < stats.length - 1 && 'mr-6 border-r',
            i < stats.length - 1 && (light ? 'border-white/20' : 'border-border'),
          )}
        >
          <p
            className={cn(
              'font-mono text-[10px] uppercase tracking-[0.12em]',
              light ? 'text-white/60' : 'text-muted-foreground',
            )}
          >
            {s.k}
          </p>
          <p
            className={cn('mt-1 text-sm font-semibold capitalize', light ? 'text-white' : 'text-foreground')}
            style={!light && s.color ? { color: s.color } : undefined}
          >
            {s.v}
          </p>
        </div>
      ))}
    </div>
  );
}

// Translate a registration status enum (or "not registered") for display.
function statusLabel(status: string | null, t: ReturnType<typeof useT>): string {
  if (!status) return t('status.notRegistered');
  const key = `status.${status}` as MessageKey;
  const out = t(key);
  return out === key ? status.replace(/_/g, ' ') : out;
}

function CompetitionHero({
  config,
  reg,
  grade,
}: {
  config: CompetitionPortalConfig;
  reg: RegistrationRow | null;
  grade: string | null;
}) {
  const t = useT();
  const status = statusLabel(reg?.status ?? null, t);
  const participantId = reg?.registrationNumber ?? '—';
  const category = grade ? t('dashboard.heroGrade', { n: grade }) : '—';
  const title = config.heroTitle ?? config.wordmark;

  // ── EMC — white card, tricolor wordmark, math watermark ──────────────
  if (config.heroStyle === 'tricolor') {
    return (
      <Card className="relative gap-0 overflow-hidden p-7 sm:p-9">
        <span
          aria-hidden
          className="pointer-events-none absolute right-5 top-1/2 hidden max-w-[42%] -translate-y-1/2 select-none bg-gradient-to-br from-[#1B6EF3] via-[#E91E8C] to-[#FF6B00] bg-clip-text text-right text-5xl font-black leading-snug tracking-[0.18em] text-transparent opacity-[0.13] sm:block lg:text-6xl"
        >
          ∑ ∂ ∫ π ∞ √ Δ ∇
        </span>
        <span
          className="inline-block rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
          style={{ background: EMC_TRI.orange }}
        >
          {config.shortName} 2026 · Eduversal Mathematics Competition
        </span>
        <h1 className="relative mt-4 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          <span style={{ color: EMC_TRI.blue }}>Eduversal</span>{' '}
          <span style={{ color: EMC_TRI.pink }}>Mathematics</span>{' '}
          <span style={{ color: EMC_TRI.orange }}>Competition</span>
        </h1>
        <p className="mt-1 text-sm font-medium italic" style={{ color: EMC_TRI.orange }}>
          {config.tagline}
        </p>
        <HeroStats
          stats={[
            { k: t('dashboard.heroParticipantId'), v: participantId, color: EMC_TRI.blue },
            { k: t('dashboard.heroCategory'), v: category, color: EMC_TRI.pink },
            { k: t('dashboard.heroTestCenter'), v: '—', color: EMC_TRI.orange },
            { k: t('dashboard.heroStatus'), v: status, color: EMC_TRI.blue },
          ]}
        />
      </Card>
    );
  }

  // ── Komodo — deep-purple gradient, lime eyebrow + status, mascot ─────
  if (config.heroStyle === 'komodo') {
    return (
      <Card
        className="relative gap-0 overflow-hidden border-0 p-7 text-white sm:p-9"
        style={{
          background:
            'radial-gradient(900px 320px at 88% -50%, #4B1FA0 0%, transparent 60%), linear-gradient(120deg, #1E0550 0%, #3A1290 100%)',
        }}
      >
        {config.mascot && (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-8 right-6 select-none text-[140px] leading-none opacity-10"
            style={{ transform: 'rotate(-12deg)' }}
          >
            {config.mascot}
          </span>
        )}
        <span
          className="inline-block rounded-md px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ background: '#B8FF00', color: '#1A0880' }}
        >
          {config.shortName} · International Math Competition
        </span>
        <h1 className="relative mt-4 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-1 text-sm italic text-white/70">“{config.tagline}”</p>
        <HeroStats
          light
          stats={[
            { k: t('dashboard.heroParticipantId'), v: participantId },
            { k: t('dashboard.heroCategory'), v: category },
            { k: t('dashboard.heroTrack'), v: '—' },
            { k: t('dashboard.heroStatus'), v: status },
          ]}
        />
      </Card>
    );
  }

  // ── Default — clean accent-gradient hero ─────────────────────────────
  return (
    <Card
      className="relative gap-0 overflow-hidden border-0 p-7 text-white sm:p-9"
      style={{ background: `linear-gradient(135deg, ${config.gradient[0]}, ${config.gradient[1]})` }}
    >
      <span className="inline-block rounded-full bg-white/15 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 ring-1 ring-white/25">
        {config.shortName} 2026
      </span>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-1 text-sm italic text-white/80">{config.tagline}</p>
      <HeroStats
        light
        stats={[
          { k: t('dashboard.heroParticipantId'), v: participantId },
          { k: t('dashboard.heroCategory'), v: category },
          { k: t('dashboard.heroStatus'), v: status },
        ]}
      />
    </Card>
  );
}

// Komodo / multi-round side panel — the rounds equivalent of the flow view's
// "Competition path": how many rounds the student has joined + each round's
// status, from the per-round registrations.
function RoundsProgressCard({
  rounds,
  regs,
  theme,
}: {
  rounds: Round[];
  regs: RegistrationRow[];
  theme: CompTheme;
}) {
  const t = useT();
  const byRound = new Map(
    regs.filter((r) => r.roundId).map((r) => [r.roundId as string, r]),
  );
  const joined = rounds.filter((r) => byRound.has(r.id)).length;
  return (
    <Card className="gap-0 p-5">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {t('dashboard.competitionPath')}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('dashboard.roundsJoined', { joined, total: rounds.length })}
      </p>
      <ul className="mt-3 space-y-2.5">
        {rounds.map((r) => {
          const reg = byRound.get(r.id);
          const paid = reg?.status === 'paid';
          return (
            <li key={r.id} className="flex items-center gap-2.5 text-sm">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  !paid && !reg && 'bg-muted text-muted-foreground',
                )}
                style={
                  paid
                    ? { background: theme.done, color: '#fff' }
                    : reg
                      ? { border: `2px solid ${theme.structural}`, color: theme.structural }
                      : undefined
                }
              >
                {paid ? <Check className="size-3" /> : ''}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground">{r.roundName}</span>
              <span className="shrink-0 text-xs capitalize text-muted-foreground">
                {reg ? reg.status.replace(/_/g, ' ') : t('dashboard.notJoined')}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Countdown({ num, lbl }: { num: number | string; lbl: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-2 py-3 text-center">
      <p className="font-serif text-2xl font-extrabold leading-none">{num}</p>
      <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/60">{lbl}</p>
    </div>
  );
}

// The mockup's right column: Next action (+ countdown), Competition path, and
// Grade levels. Reuses the same flow-progress data the timeline renders.
function CompetitionSidePanel({
  steps,
  grade,
  slug,
  theme,
  onCompleteProfile,
}: {
  steps: FlowProgressStep[];
  grade: string | null;
  slug: string;
  theme: CompTheme;
  onCompleteProfile: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const current = steps.find((s) => s.status === 'current');
  const done = steps.filter((s) => s.status === 'done').length;
  const total = steps.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const target = current?.startsOn || current?.endsOn || null;
  const days = target
    ? Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / 86400000))
    : null;

  // The Next-action CTA sits on the dark gradient card, so it's styled with
  // the competition accent (orange for EMC) + white text rather than the
  // page's default primary button — it has to pop against the gradient.
  const ctaCls =
    'flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-[filter] hover:brightness-110';
  const ctaStyle = { background: theme.fill, color: theme.fillInk };
  const cta = (() => {
    if (!current) return null;
    if (current.stepKey === 'registration' || current.checkType === 'profile') {
      return (
        <button type="button" className={ctaCls} style={ctaStyle} onClick={onCompleteProfile}>
          {t('dashboard.fillRegForm')}
        </button>
      );
    }
    if (current.checkType === 'payment') {
      return (
        <Link href={competitionPaths(slug).pay} className={ctaCls} style={ctaStyle}>
          {t('dashboard.payRegistrationFee')}
        </Link>
      );
    }
    if (current.checkType === 'documents') {
      return (
        <Link href="/account/documents" className={ctaCls} style={ctaStyle}>
          {t('dashboard.uploadDocuments')}
        </Link>
      );
    }
    return null;
  })();

  const g = grade ? parseInt(grade, 10) : NaN;
  const bracket = Number.isNaN(g) ? null : g <= 6 ? 'SD' : g <= 9 ? 'SMP' : 'SMA';
  const levels = [
    { key: 'SD', label: 'SD', range: 'Grades 4–6' },
    { key: 'SMP', label: 'SMP / MTs', range: 'Grades 7–9' },
    { key: 'SMA', label: 'SMA / MA / SMK', range: 'Grades 10–12' },
  ];

  return (
    <div className="space-y-4 lg:sticky lg:top-20">
      {current && (
        <Card
          className="gap-0 overflow-hidden border-0 p-6 text-white"
          style={{ background: theme.panelGradient }}
        >
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
            <Zap className="size-3.5" />
            {t('dashboard.nextAction')}
          </p>
          <h3 className="mt-2 font-serif text-lg font-semibold leading-snug">
            {pickText(current.title, current.titleId, locale)}
          </h3>
          {current.description && (
            <p className="mt-1 text-sm text-white/80">
              {pickText(current.description, current.descriptionId, locale)}
            </p>
          )}
          {cta && <div className="mt-4">{cta}</div>}
          {days != null && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Countdown num={days} lbl={t('dashboard.cdDays')} />
              <Countdown num={Math.floor(days / 7)} lbl={t('dashboard.cdWeeks')} />
              <Countdown num={`H-${days}`} lbl={t('dashboard.cdToEvent')} />
            </div>
          )}
        </Card>
      )}

      <Card className="gap-0 p-5">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t('dashboard.competitionPath')}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${theme.structural}, ${theme.fill})` }}
          />
        </div>
        <ul className="mt-4 space-y-2.5">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 text-sm">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  s.status === 'upcoming' && 'bg-muted text-muted-foreground',
                )}
                style={
                  s.status === 'done'
                    ? { background: theme.done, color: '#fff' }
                    : s.status === 'current'
                      ? { background: theme.fill, color: theme.fillInk }
                      : undefined
                }
              >
                {s.status === 'done' ? <Check className="size-3" /> : s.stepOrder}
              </span>
              <span className={cn('truncate', s.status === 'upcoming' ? 'text-muted-foreground' : 'text-foreground')}>
                {pickText(s.title, s.titleId, locale)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {bracket && (
        <Card className="gap-0 p-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t('dashboard.gradeLevels')}
          </p>
          <ul className="mt-3 space-y-2">
            {levels.map((l) => {
              const active = l.key === bracket;
              return (
                <li
                  key={l.key}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                    active ? 'font-semibold' : 'text-muted-foreground',
                  )}
                  style={active ? { background: theme.structuralSoft, color: theme.structural } : undefined}
                >
                  <span>{l.label}</span>
                  <span className="text-xs">{l.range}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default function CompetitionDashboardPage() {
  const t = useT();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const theme = compTheme(config);

  const { user } = useCompetitionAuth();
  // `compError` surfaces a clear failure when the competition can't be
  // resolved — e.g. the row was filtered out by the international-only
  // catalog gate, or doesn't exist. Without this the dashboard hung on
  // "Loading your registration…" forever because the downstream fetches
  // never fired (they're gated on `comp?.id`).
  const { comp, loading: compLoading, error: compError } = usePortalComp(slug);

  const [regs, setRegs] = useState<RegistrationRow[] | null>(null);
  const [progress, setProgress] = useState<FlowProgress | null>(null);
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [enroll, setEnroll] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [registering, setRegistering] = useState<string | null>(null);
  // When POST /registrations returns 409 PROFILE_INCOMPLETE, capture what the
  // user was trying to register for so we can retry once the dialog saves the
  // missing fields.
  const [profileGate, setProfileGate] = useState<{
    roundId: string | null;
    meta?: Record<string, unknown>;
    missingFields: ProfileFieldKey[];
  } | null>(null);
  // Komodo + future age-grouped comps — per-round creature classification.
  // Empty array for grade-based comps; null while we haven't fetched yet.
  const [creatureRounds, setCreatureRounds] = useState<CreatureRow[] | null>(null);
  // The caller's stored country code (uppercase, e.g. 'ID', 'MY', 'US').
  // Drives the local-vs-international price the rounds panel shows.
  // Null while we haven't fetched yet OR if they have no country saved.
  const [userCountry, setUserCountry] = useState<string | null>(null);
  // The caller's stored grade (1–12) — drives the hero's Category stat.
  const [userGrade, setUserGrade] = useState<string | null>(null);
  // The competition's full `required_profile_fields` list (e.g. Komodo's 9
  // mandatory keys). The dialog renders every entry — pre-filled with the
  // student's current value — so they can confirm/edit before payment.
  const [requiredProfileFields, setRequiredProfileFields] = useState<ProfileFieldKey[]>([]);
  // Bumped after the in-dashboard registration modal saves, so the
  // flow-progress effect re-fetches (the profile step's done-state is
  // computed server-side from the saved fields).
  const [bump, setBump] = useState(0);
  const [regFormOpen, setRegFormOpen] = useState(false);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  // One-shot fetch of the caller's profile to read `country`. The competition
  // auth context doesn't carry this field, so we read it directly. Best-effort
  // — on failure we leave userCountry null and the panel falls back to the
  // local (IDR) price for everyone.
  useEffect(() => {
    let cancelled = false;
    emcHttp
      .get<{ country?: string | null; grade?: string | null }>('/users/me')
      .then((me) => {
        if (cancelled) return;
        setUserCountry(typeof me.country === 'string' ? me.country : null);
        setUserGrade(typeof me.grade === 'string' ? me.grade : null);
      })
      .catch(() => { /* silent — see comment above */ });
    return () => { cancelled = true; };
  }, [bump]);

  const refresh = async (compId?: string | null) => {
    try {
      const q = compId ? `?compId=${encodeURIComponent(compId)}` : '';
      setRegs(await emcHttp.get<RegistrationRow[]>(`/registrations${q}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load registrations');
    }
  };

  useEffect(() => {
    if (comp?.id) void refresh(comp.id);
  }, [comp?.id]);

  // A competition's rounds — drives the multi-round per-round panel. An empty
  // array means a single-stage competition (the flow-stepper path). Rounds an
  // operator has deactivated are filtered out so students never see them.
  useEffect(() => {
    if (!comp?.id) return;
    emcHttp
      .get<{ rounds?: Round[]; requiredProfileFields?: ProfileFieldKey[] }>(
        `/competitions/${comp.id}`,
      )
      .then((d) => {
        setRounds(
          Array.isArray(d.rounds)
            ? d.rounds.filter((r) => r.isActive !== false)
            : [],
        );
        setRequiredProfileFields(
          Array.isArray(d.requiredProfileFields) ? d.requiredProfileFields : [],
        );
      })
      .catch(() => {
        setRounds([]);
        setRequiredProfileFields([]);
      });
  }, [comp?.id]);

  // Komodo / age-grouped comps — fetch the per-round creature classification
  // for the calling student. Empty `rounds` here just means this competition
  // has no age-cutoff rounds (a grade-based comp); the card is hidden.
  useEffect(() => {
    if (!comp?.id) return;
    let cancelled = false;
    emcHttp
      .get<{ rounds: CreatureRow[] }>(`/competitions/${comp.id}/my-creature`)
      .then((d) => { if (!cancelled) setCreatureRounds(d.rounds ?? []); })
      .catch(() => { if (!cancelled) setCreatureRounds([]); });
    return () => { cancelled = true; };
  }, [comp?.id]);

  // Once we know the registration, pull its step-flow progress + (for
  // affiliated competitions) the issued access credentials.
  const reg = regs?.[0];
  useEffect(() => {
    if (!reg?.id) {
      setProgress(null);
      setAccess(null);
      return;
    }
    let cancelled = false;
    emcHttp
      .get<FlowProgress>(`/registrations/${reg.id}/flow-progress`)
      .then((p) => {
        if (!cancelled) setProgress(p);
      })
      .catch(() => {
        // No flow configured / fetch failed → the STATUS_COPY fallback renders.
        if (!cancelled) setProgress(null);
      });
    emcHttp
      .get<AccessInfo>(`/registrations/${reg.id}/credentials`)
      .then((a) => {
        if (!cancelled) setAccess(a);
      })
      .catch(() => {
        if (!cancelled) setAccess(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reg?.id, bump]);

  // Extract a PROFILE_INCOMPLETE response. Returns the missing-fields list
  // (always at least one element when the server returned the gate) or null
  // when the error is something else.
  const profileGateFrom = (e: unknown): ProfileFieldKey[] | null => {
    if (!(e instanceof HttpError) || e.status !== 409) return null;
    if (e.body?.code !== 'PROFILE_INCOMPLETE') return null;
    const raw = e.body?.missingFields;
    if (!Array.isArray(raw)) return null;
    return raw.filter((x): x is ProfileFieldKey => typeof x === 'string');
  };

  const enrollNow = async () => {
    if (!comp?.id) return;
    // If the competition declares required profile fields, open the dialog
    // FIRST so the student reviews every field with their current values
    // pre-filled — not only the ones currently blank. The dialog's onCompleted
    // path runs the actual POST. Comps with no required fields fall through
    // to the direct POST below.
    if (requiredProfileFields.length > 0) {
      setProfileGate({ roundId: null, missingFields: requiredProfileFields });
      return;
    }
    setEnroll(true);
    setErr(null);
    try {
      await emcHttp.post('/registrations', { id: crypto.randomUUID(), compId: comp.id });
      await refresh(comp.id);
      // Open the registration form straight away so the student fills their
      // details in-place (mockup flow) instead of being sent to a profile page.
      setRegFormOpen(true);
    } catch (e) {
      const gate = profileGateFrom(e);
      if (gate) {
        // Defensive fallback — the server may have added a required field
        // after the page loaded. Re-open with the server-reported subset.
        setProfileGate({ roundId: null, missingFields: gate });
      } else {
        const msg = e instanceof Error ? e.message : '';
        if (!/already exists/i.test(msg)) setErr(msg || 'Enroll failed');
        else await refresh(comp.id);
      }
    } finally {
      setEnroll(false);
    }
  };

  const enrollRound = async (roundId: string, meta?: Record<string, unknown>) => {
    if (!comp?.id) return;
    if (requiredProfileFields.length > 0) {
      setProfileGate({ roundId, meta, missingFields: requiredProfileFields });
      return;
    }
    setRegistering(roundId);
    setErr(null);
    try {
      await emcHttp.post('/registrations', {
        id: crypto.randomUUID(),
        compId: comp.id,
        roundId,
        ...(meta ? { meta } : {}),
      });
      await refresh(comp.id);
    } catch (e) {
      const gate = profileGateFrom(e);
      if (gate) {
        setProfileGate({ roundId, meta, missingFields: gate });
      } else {
        setErr(e instanceof Error ? e.message : 'Could not register for this round');
      }
    } finally {
      setRegistering(null);
    }
  };

  // After the Profile Completion Dialog saves the missing fields, retry the
  // original registration POST so the student lands on payment with no extra
  // clicks. Mirrors enrollNow / enrollRound but skips the loading state so the
  // dialog's spinner has already covered the user-visible wait.
  const retryAfterProfileSaved = async () => {
    if (!comp?.id || !profileGate) return;
    const { roundId, meta } = profileGate;
    setProfileGate(null);
    try {
      await emcHttp.post('/registrations', {
        id: crypto.randomUUID(),
        compId: comp.id,
        ...(roundId ? { roundId } : {}),
        ...(meta ? { meta } : {}),
      });
      await refresh(comp.id);
    } catch (e) {
      // If the server still reports missing fields, surface them again.
      const gate = profileGateFrom(e);
      if (gate) {
        setProfileGate({ roundId, meta, missingFields: gate });
      } else {
        setErr(e instanceof Error ? e.message : 'Could not register');
      }
    }
  };

  // Friendly context label for the dialog — the round name when registering
  // for a multi-round comp; the competition name otherwise.
  const profileGateContext = (() => {
    if (!profileGate) return undefined;
    if (profileGate.roundId && rounds) {
      const r = rounds.find((rr) => rr.id === profileGate.roundId);
      if (r) return `${config?.shortName ?? ''} — ${r.roundName}`.trim();
    }
    return config?.shortName;
  })();

  if (!config) return null;

  const hasFlow = !!progress && progress.steps.length > 0;
  const fallbackCopy = reg ? STATUS_COPY[reg.status] : null;

  // International students (country != ID) only see this one competition —
  // the "All competitions" back link is dead navigation for them.
  const isInternationalUser =
    !!userCountry && userCountry.toUpperCase() !== 'ID';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-10">
        <header className="space-y-3">
          {!isInternationalUser && (
            <Link
              href="/competitions"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {t('dashboard.backToAll')}
            </Link>
          )}
          <CompetitionHero config={config} reg={reg ?? null} grade={userGrade} />
        </header>

        {err && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {err}
          </div>
        )}

        {/* If the competition itself failed to resolve, surface a clear error
            instead of the loading card. Without this the dashboard hangs
            forever when the catalog filter drops the comp (e.g. an
            international student visiting a competition that wasn't flagged
            is_international=true). */}
        {compError || (!compLoading && !comp?.id) ? (
          <Card className="items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {t('dashboard.notAvailableTitle')}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              {compError ?? t('dashboard.notAvailableBody')}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/competitions">{t('dashboard.browseCompetitions')}</Link>
            </Button>
          </Card>
        ) : !regs || rounds === null ? (
          <Card className="items-center gap-3 p-10 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('dashboard.loadingRegistration')}</p>
          </Card>
        ) : rounds.length > 0 ? (
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              <RoundsPanel
                rounds={rounds}
                regs={regs}
                slug={slug}
                wordmark={config.wordmark}
                registering={registering}
                onRegister={enrollRound}
                userCountry={userCountry}
              />
              <Card className="gap-0 p-7">
                <h2 className="font-serif text-xl font-medium text-foreground">{t('dashboard.yourExams')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.examsHint')}</p>
                <ExamBlock compId={comp?.id ?? null} slug={slug} />
              </Card>
              <Card className="gap-0 p-7">
                <h2 className="font-serif text-xl font-medium text-foreground">
                  {t('dashboard.yourCertificates')}
                </h2>
                <CertificateBlock compId={comp?.id ?? null} />
              </Card>
            </div>
            <div className="space-y-4 lg:sticky lg:top-20">
              {creatureRounds && creatureRounds.length > 0 && (
                <CreatureCard rounds={creatureRounds} />
              )}
              <RoundsProgressCard rounds={rounds} regs={regs} theme={theme} />
            </div>
          </div>
        ) : reg ? (
          hasFlow && progress ? (
            <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
              <Card className="gap-0 p-7">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
                    Status · {reg.status.replace(/_/g, ' ')}
                  </p>
                  {reg.registrationNumber && (
                    <p className="font-mono text-xs text-muted-foreground">
                      #&nbsp;{reg.registrationNumber}
                    </p>
                  )}
                </div>
                <h2 className="mt-2 font-serif text-xl font-medium text-foreground">
                  {t('dashboard.activityTimeline')}
                </h2>
                <p className="mt-1 mb-4 text-sm text-muted-foreground">
                  {t('dashboard.timelineSubtitle', { name: config.wordmark })}
                </p>
                <Stepper
                  steps={progress.steps}
                  externalUrl={access?.externalUrl ?? null}
                  credential={access?.credential ?? null}
                  compId={comp?.id ?? null}
                  slug={slug}
                  theme={theme}
                  onCompleteProfile={() => setRegFormOpen(true)}
                />
              </Card>
              <CompetitionSidePanel
                steps={progress.steps}
                grade={userGrade}
                slug={slug}
                theme={theme}
                onCompleteProfile={() => setRegFormOpen(true)}
              />
            </div>
          ) : (
            <Card className="gap-0 p-7">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
                  Status · {reg.status.replace(/_/g, ' ')}
                </p>
                {reg.registrationNumber && (
                  <p className="font-mono text-xs text-muted-foreground">
                    #&nbsp;{reg.registrationNumber}
                  </p>
                )}
              </div>
              <h2 className="mt-2 font-serif text-xl font-medium text-foreground">
                {fallbackCopy?.title ?? 'Registration recorded.'}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {fallbackCopy?.body ?? `Status: ${reg.status}`}
              </p>
              {reg.status === 'pending_payment' && (
                <Button asChild className="mt-4 w-fit">
                  <Link href={competitionPaths(slug).pay}>{t('dashboard.payRegistrationFee')}</Link>
                </Button>
              )}
            </Card>
          )
        ) : (
          <Card className="gap-0 p-8 text-center">
            <h2 className="font-serif text-xl font-medium text-foreground">
              {t('dashboard.welcomeTo', { name: config.wordmark })}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('dashboard.noRegistration')}</p>
            <Button className="mx-auto mt-5 w-fit" onClick={enrollNow} disabled={enroll || !comp?.id}>
              {enroll ? t('dashboard.enrolling') : t('dashboard.registerFor', { name: `${config.shortName} 2026` })}
            </Button>
            {!comp?.id && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                {config.shortName} 2026 isn’t configured yet. Ask an admin to run the latest migration.
              </p>
            )}
          </Card>
        )}
        <RegistrationFormDialog
          open={regFormOpen}
          onClose={() => setRegFormOpen(false)}
          compName={`${config.shortName} 2026`}
          onSaved={() => {
            void refresh(comp?.id ?? null);
            setBump((b) => b + 1);
          }}
        />
        <ProfileCompletionDialog
          open={!!profileGate}
          missingFields={profileGate?.missingFields ?? []}
          contextLabel={profileGateContext}
          onCancel={() => setProfileGate(null)}
          onCompleted={() => void retryAfterProfileSaved()}
        />
    </div>
  );
}
