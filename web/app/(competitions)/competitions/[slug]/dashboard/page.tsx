'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, CalendarDays, Check, Loader2 } from 'lucide-react';
import { emcHttp, HttpError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
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

type StepStatus = 'done' | 'current' | 'upcoming';
type CheckType = 'profile' | 'documents' | 'payment' | 'approval' | 'none';

interface FlowProgressStep {
  id: string;
  stepOrder: number;
  stepKey: string;
  title: string;
  description: string | null;
  checkType: CheckType;
  status: StepStatus;
  startsOn: string | null;
  endsOn: string | null;
  location: string | null;
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
function currentHint(checkType: CheckType): string {
  switch (checkType) {
    case 'profile':
      return 'Complete your profile to move forward.';
    case 'documents':
      return 'Upload the documents this competition requires.';
    case 'payment':
      return 'Pay your registration fee to continue.';
    case 'approval':
      return 'An organizer is reviewing your registration — no action needed.';
    case 'none':
      return '';
  }
}

function StepNode({ status, order }: { status: StepStatus; order: number }) {
  if (status === 'done') {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-4" />
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-sm font-semibold text-primary">
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
      <h2 className="font-serif text-xl font-medium text-foreground">Competition rounds</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Register and pay for each round of {wordmark} you want to enter.
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
                    <dt className="font-mono uppercase tracking-wide text-[10px]">Mode</dt>
                    <dd className="text-foreground">{round.roundType}</dd>
                  </div>
                  {examDate && (
                    <div className="flex gap-1.5">
                      <dt className="font-mono uppercase tracking-wide text-[10px]">Exam</dt>
                      <dd className="text-foreground">{examDate}</dd>
                    </div>
                  )}
                  {deadline && !reg && state.kind !== 'missed' && (
                    <div className="flex gap-1.5">
                      <dt className="font-mono uppercase tracking-wide text-[10px]">Closes</dt>
                      <dd className="text-foreground">{deadline}</dd>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <dt className="font-mono uppercase tracking-wide text-[10px]">Fee</dt>
                    <dd className="text-foreground">{price ?? 'Free'}</dd>
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
                    Missed
                  </span>
                ) : null}

                {reg ? (
                  reg.status === 'pending_payment' ? (
                    intlEligible ? (
                      <Button size="sm" asChild className="w-full sm:w-auto">
                        <Link href={`${competitionPaths(slug).pay}?registrationId=${reg.id}`}>
                          Pay {usd(round.feeInternational ?? 0)} (IDR-equivalent)
                        </Link>
                      </Button>
                    ) : intl ? (
                      <p className="break-words text-xs text-muted-foreground">
                        International payment is offline for now. Contact the organizer to settle your{' '}
                        {round.feeInternational != null ? usd(round.feeInternational) : 'round'} fee.
                      </p>
                    ) : (
                      <Button size="sm" asChild className="w-full sm:w-auto">
                        <Link href={`${competitionPaths(slug).pay}?registrationId=${reg.id}`}>
                          Pay round fee
                        </Link>
                      </Button>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground sm:text-right">
                      {STATUS_COPY[reg.status]?.body ?? `Status: ${reg.status.replace(/_/g, ' ')}`}
                    </p>
                  )
                ) : state.kind === 'missed' ? (
                  <p className="text-xs text-muted-foreground sm:text-right">
                    You didn’t register before this round closed.
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
                    {registering === round.id ? 'Registering…' : 'Register for this round'}
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

// Status badge per timeline stage (mockup parity).
function StepBadge({ status }: { status: StepStatus }) {
  const map = {
    done: { label: 'Done', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
    current: { label: 'Action needed', cls: 'bg-primary/10 text-primary' },
    upcoming: { label: 'Upcoming', cls: 'bg-muted text-muted-foreground' },
  } as const;
  const m = map[status];
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}

function Stepper({
  steps,
  externalUrl,
  credential,
  compId,
  slug,
  onCompleteProfile,
}: {
  steps: FlowProgressStep[];
  externalUrl: string | null;
  credential: AffiliatedCredential | null;
  compId: string | null;
  slug: string;
  onCompleteProfile: () => void;
}) {
  return (
    <ol className="mt-1">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const hint = s.status === 'current' ? currentHint(s.checkType) : '';
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
              <StepNode status={s.status} order={s.stepOrder} />
              {!last && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className={cn('flex-1', !last && 'pb-5')}>
              <div
                className={cn(
                  s.status === 'current' &&
                    'rounded-xl border border-primary/50 bg-primary/[0.03] p-4 shadow-sm',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={cn(
                      'text-sm',
                      s.status === 'upcoming' ? 'text-muted-foreground' : 'font-semibold text-foreground',
                    )}
                  >
                    {s.title}
                  </p>
                  <StepBadge status={s.status} />
                </div>
                {(s.startsOn || s.endsOn || s.location) && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5 shrink-0" />
                    <span>
                      {[stageDateLabel(s.startsOn, s.endsOn), s.location].filter(Boolean).join(' · ')}
                    </span>
                  </p>
                )}
                {s.status !== 'upcoming' && s.description && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>
                )}
                {hint && (
                  <p className="mt-2 rounded-md bg-primary/5 px-3 py-2 text-xs leading-relaxed text-primary">
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
                        Fill registration form
                      </Button>
                    )}
                    {showPay && (
                      <Button asChild size="sm" variant={showRegForm ? 'outline' : 'default'}>
                        <Link href={competitionPaths(slug).pay}>Pay registration fee</Link>
                      </Button>
                    )}
                  </div>
                )}
                {showProfile && (
                  <Button size="sm" className="mt-3" onClick={onCompleteProfile}>
                    Complete registration form
                  </Button>
                )}
                {showDocs && (
                  <Button asChild size="sm" className="mt-3">
                    <Link href="/account/documents">Upload documents</Link>
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

function CompetitionHero({
  config,
  reg,
  grade,
}: {
  config: CompetitionPortalConfig;
  reg: RegistrationRow | null;
  grade: string | null;
}) {
  const status = reg ? reg.status.replace(/_/g, ' ') : 'Not registered';
  const participantId = reg?.registrationNumber ?? '—';
  const category = grade ? `Grade ${grade}` : '—';

  if (config.slug === 'emc') {
    return (
      <Card className="relative gap-0 overflow-hidden p-7 sm:p-9">
        <span
          aria-hidden
          className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 select-none bg-gradient-to-br from-[#1B6EF3] via-[#E91E8C] to-[#FF6B00] bg-clip-text text-5xl font-black tracking-[0.18em] text-transparent opacity-[0.08] lg:block"
        >
          ∑ ∂ ∫ π ∞ √
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
            { k: 'Participant ID', v: participantId, color: EMC_TRI.blue },
            { k: 'Category', v: category, color: EMC_TRI.pink },
            { k: 'Test Center', v: '—', color: EMC_TRI.orange },
            { k: 'Status', v: status, color: EMC_TRI.blue },
          ]}
        />
      </Card>
    );
  }

  return (
    <Card
      className="relative gap-0 overflow-hidden border-0 p-7 text-white sm:p-9"
      style={{ background: `linear-gradient(135deg, ${config.gradient[0]}, ${config.gradient[1]})` }}
    >
      <span className="inline-block rounded-full bg-white/15 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 ring-1 ring-white/25">
        {config.shortName} 2026
      </span>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        {config.wordmark}
      </h1>
      <p className="mt-1 text-sm italic text-white/80">{config.tagline}</p>
      <HeroStats
        light
        stats={[
          { k: 'Participant ID', v: participantId },
          { k: 'Category', v: category },
          { k: 'Status', v: status },
        ]}
      />
    </Card>
  );
}

// Komodo / multi-round side panel — the rounds equivalent of the flow view's
// "Competition path": how many rounds the student has joined + each round's
// status, from the per-round registrations.
function RoundsProgressCard({ rounds, regs }: { rounds: Round[]; regs: RegistrationRow[] }) {
  const byRound = new Map(
    regs.filter((r) => r.roundId).map((r) => [r.roundId as string, r]),
  );
  const joined = rounds.filter((r) => byRound.has(r.id)).length;
  return (
    <Card className="gap-0 p-5">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Competition path
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {joined} of {rounds.length} rounds joined
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
                  paid
                    ? 'bg-primary text-primary-foreground'
                    : reg
                      ? 'border-2 border-primary text-primary'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {paid ? <Check className="size-3" /> : ''}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground">{r.roundName}</span>
              <span className="shrink-0 text-xs capitalize text-muted-foreground">
                {reg ? reg.status.replace(/_/g, ' ') : 'Not joined'}
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
    <div className="rounded-lg bg-white/10 p-2 text-center">
      <p className="font-serif text-lg font-bold leading-none">{num}</p>
      <p className="mt-1 text-[9px] uppercase tracking-wide text-white/60">{lbl}</p>
    </div>
  );
}

// The mockup's right column: Next action (+ countdown), Competition path, and
// Grade levels. Reuses the same flow-progress data the timeline renders.
function CompetitionSidePanel({
  steps,
  grade,
  slug,
  onCompleteProfile,
}: {
  steps: FlowProgressStep[];
  grade: string | null;
  slug: string;
  onCompleteProfile: () => void;
}) {
  const current = steps.find((s) => s.status === 'current');
  const done = steps.filter((s) => s.status === 'done').length;
  const total = steps.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const target = current?.startsOn || current?.endsOn || null;
  const days = target
    ? Math.max(0, Math.ceil((new Date(target).getTime() - Date.now()) / 86400000))
    : null;

  const cta = (() => {
    if (!current) return null;
    if (current.stepKey === 'registration' || current.checkType === 'profile') {
      return (
        <Button className="w-full" onClick={onCompleteProfile}>
          Fill registration form
        </Button>
      );
    }
    if (current.checkType === 'payment') {
      return (
        <Button asChild className="w-full">
          <Link href={competitionPaths(slug).pay}>Pay registration fee</Link>
        </Button>
      );
    }
    if (current.checkType === 'documents') {
      return (
        <Button asChild className="w-full">
          <Link href="/account/documents">Upload documents</Link>
        </Button>
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
        <Card className="gap-0 overflow-hidden border-0 bg-gradient-to-br from-[#1F0454] via-[#3D087B] to-[#5627FF] p-6 text-white">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
            ⚡ Next action
          </p>
          <h3 className="mt-2 font-serif text-lg font-semibold leading-snug">{current.title}</h3>
          {current.description && <p className="mt-1 text-sm text-white/80">{current.description}</p>}
          {cta && <div className="mt-4">{cta}</div>}
          {days != null && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Countdown num={days} lbl="Days" />
              <Countdown num={Math.floor(days / 7)} lbl="Weeks" />
              <Countdown num={`H-${days}`} lbl="To event" />
            </div>
          )}
        </Card>
      )}

      <Card className="gap-0 p-5">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Competition path
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <ul className="mt-4 space-y-2.5">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 text-sm">
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  s.status === 'done'
                    ? 'bg-primary text-primary-foreground'
                    : s.status === 'current'
                      ? 'border-2 border-primary text-primary'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {s.status === 'done' ? <Check className="size-3" /> : s.stepOrder}
              </span>
              <span className={cn('truncate', s.status === 'upcoming' ? 'text-muted-foreground' : 'text-foreground')}>
                {s.title}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {bracket && (
        <Card className="gap-0 p-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Grade levels
          </p>
          <ul className="mt-3 space-y-2">
            {levels.map((l) => {
              const active = l.key === bracket;
              return (
                <li
                  key={l.key}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                    active ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground',
                  )}
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
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);

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
              All competitions
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
              This competition isn’t available to your account.
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              {compError ??
                'Check the catalog for competitions you can register for. If you think this is a mistake, contact the organizer.'}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/competitions">Browse competitions</Link>
            </Button>
          </Card>
        ) : !regs || rounds === null ? (
          <Card className="items-center gap-3 p-10 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading your registration…</p>
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
                <h2 className="font-serif text-xl font-medium text-foreground">Your exams</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Exams unlock once you’ve registered and paid for their round.
                </p>
                <ExamBlock compId={comp?.id ?? null} slug={slug} />
              </Card>
              <Card className="gap-0 p-7">
                <h2 className="font-serif text-xl font-medium text-foreground">
                  Your certificates
                </h2>
                <CertificateBlock compId={comp?.id ?? null} />
              </Card>
            </div>
            <div className="space-y-4 lg:sticky lg:top-20">
              {creatureRounds && creatureRounds.length > 0 && (
                <CreatureCard rounds={creatureRounds} />
              )}
              <RoundsProgressCard rounds={rounds} regs={regs} />
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
                  Activity timeline
                </h2>
                <p className="mt-1 mb-4 text-sm text-muted-foreground">
                  Your journey through {config.wordmark}.
                </p>
                <Stepper
                  steps={progress.steps}
                  externalUrl={access?.externalUrl ?? null}
                  credential={access?.credential ?? null}
                  compId={comp?.id ?? null}
                  slug={slug}
                  onCompleteProfile={() => setRegFormOpen(true)}
                />
              </Card>
              <CompetitionSidePanel
                steps={progress.steps}
                grade={userGrade}
                slug={slug}
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
                  <Link href={competitionPaths(slug).pay}>Pay registration fee</Link>
                </Button>
              )}
            </Card>
          )
        ) : (
          <Card className="gap-0 p-8 text-center">
            <h2 className="font-serif text-xl font-medium text-foreground">
              Welcome to {config.wordmark}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You don’t have a registration yet. Enroll now to claim your spot.
            </p>
            <Button className="mx-auto mt-5 w-fit" onClick={enrollNow} disabled={enroll || !comp?.id}>
              {enroll ? 'Enrolling…' : `Register for ${config.shortName} 2026`}
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
