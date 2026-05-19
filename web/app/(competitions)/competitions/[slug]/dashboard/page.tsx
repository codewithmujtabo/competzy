'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
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
  location: string | null;
  gating: { mode?: string; rule?: string; requiresRoundId?: string } | null;
  isActive: boolean;
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
}: {
  rounds: Round[];
  regs: RegistrationRow[];
  slug: string;
  wordmark: string;
  registering: string | null;
  onRegister: (roundId: string, meta?: Record<string, unknown>) => void;
}) {
  const byRound = new Map(regs.filter((r) => r.roundId).map((r) => [r.roundId, r]));
  const [globalRound, setGlobalRound] = useState<Round | null>(null);

  return (
    <Card className="gap-0 p-7">
      <h2 className="font-serif text-xl font-medium text-foreground">Competition rounds</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Register and pay for each round of {wordmark} you want to enter.
      </p>
      <ol className="space-y-3">
        {rounds.map((round, i) => {
          const reg = byRound.get(round.id);
          const state = roundState(round, reg, regs, rounds);
          const categoryLabel = CATEGORY_LABEL[round.roundCategory];
          return (
            <li key={round.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {round.roundName || `Round ${i + 1}`}
                    </p>
                    {categoryLabel && (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                        {categoryLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {round.roundType}
                    {round.location ? ` · ${round.location}` : ''}
                    {round.examDate
                      ? ` · ${new Date(round.examDate).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}`
                      : ''}
                    {` · ${round.fee > 0 ? rupiah(round.fee) : 'Free'}`}
                  </p>
                </div>
                {reg ? (
                  <StatusPill status={reg.status} />
                ) : state.kind === 'missed' ? (
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    Missed
                  </span>
                ) : null}
              </div>

              <div className="mt-3">
                {reg ? (
                  reg.status === 'pending_payment' ? (
                    <Button size="sm" asChild>
                      <Link href={`${competitionPaths(slug).pay}?registrationId=${reg.id}`}>
                        Pay round fee
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {STATUS_COPY[reg.status]?.body ??
                        `Status: ${reg.status.replace(/_/g, ' ')}`}
                    </p>
                  )
                ) : state.kind === 'missed' ? (
                  <p className="text-xs text-muted-foreground">
                    You didn’t register before this round closed.
                  </p>
                ) : state.kind === 'locked' ? (
                  <p className="text-xs text-muted-foreground">{state.note}</p>
                ) : (
                  <Button
                    size="sm"
                    disabled={registering === round.id}
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
      </ol>

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

function Stepper({
  steps,
  externalUrl,
  credential,
  compId,
  slug,
}: {
  steps: FlowProgressStep[];
  externalUrl: string | null;
  credential: AffiliatedCredential | null;
  compId: string | null;
  slug: string;
}) {
  return (
    <ol className="mt-1">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const hint = s.status === 'current' ? currentHint(s.checkType) : '';
        const showAccess = s.stepKey === 'external_access' && s.status !== 'upcoming';
        const showExam = s.stepKey === 'exam' && s.status !== 'upcoming';
        const showCert = s.stepKey === 'results';
        const showPay = s.checkType === 'payment' && s.status === 'current';
        const showProfile = s.checkType === 'profile' && s.status === 'current';
        const showDocs = s.checkType === 'documents' && s.status === 'current';
        return (
          <li key={s.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <StepNode status={s.status} order={s.stepOrder} />
              {!last && <span className="w-px flex-1 bg-border" />}
            </div>
            <div className={last ? 'flex-1' : 'flex-1 pb-6'}>
              <p
                className={
                  'text-sm ' +
                  (s.status === 'upcoming'
                    ? 'text-muted-foreground'
                    : s.status === 'current'
                      ? 'font-semibold text-foreground'
                      : 'font-medium text-foreground')
                }
              >
                {s.title}
              </p>
              {s.status !== 'upcoming' && s.description && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
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
              {showPay && (
                <Button asChild size="sm" className="mt-2">
                  <Link href={competitionPaths(slug).pay}>Pay registration fee</Link>
                </Button>
              )}
              {showProfile && (
                <Button asChild size="sm" className="mt-2">
                  <Link href="/account/profile">Complete your profile</Link>
                </Button>
              )}
              {showDocs && (
                <Button asChild size="sm" className="mt-2">
                  <Link href="/account/documents">Upload documents</Link>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function CompetitionDashboardPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);

  const { user } = useCompetitionAuth();
  const { comp } = usePortalComp(slug);

  const [regs, setRegs] = useState<RegistrationRow[] | null>(null);
  const [progress, setProgress] = useState<FlowProgress | null>(null);
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [enroll, setEnroll] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [registering, setRegistering] = useState<string | null>(null);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

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
      .get<{ rounds?: Round[] }>(`/competitions/${comp.id}`)
      .then((d) =>
        setRounds(
          Array.isArray(d.rounds)
            ? d.rounds.filter((r) => r.isActive !== false)
            : [],
        ),
      )
      .catch(() => setRounds([]));
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
  }, [reg?.id]);

  const enrollNow = async () => {
    if (!comp?.id) return;
    setEnroll(true);
    setErr(null);
    try {
      await emcHttp.post('/registrations', { id: crypto.randomUUID(), compId: comp.id });
      await refresh(comp.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (!/already exists/i.test(msg)) setErr(msg || 'Enroll failed');
      else await refresh(comp.id);
    } finally {
      setEnroll(false);
    }
  };

  const enrollRound = async (roundId: string, meta?: Record<string, unknown>) => {
    if (!comp?.id) return;
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
      setErr(e instanceof Error ? e.message : 'Could not register for this round');
    } finally {
      setRegistering(null);
    }
  };

  if (!config) return null;

  const hasFlow = !!progress && progress.steps.length > 0;
  const fallbackCopy = reg ? STATUS_COPY[reg.status] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-10">
        <header className="space-y-3">
          <Link
            href="/competitions"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            All competitions
          </Link>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
              {config.shortName} 2026
            </p>
            <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">
              Hi {user?.fullName || user?.full_name || 'there'} 👋
            </h1>
          </div>
        </header>

        {err && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {err}
          </div>
        )}

        {!regs || rounds === null ? (
          <Card className="items-center gap-3 p-10 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading your registration…</p>
          </Card>
        ) : rounds.length > 0 ? (
          <>
            <RoundsPanel
              rounds={rounds}
              regs={regs}
              slug={slug}
              wordmark={config.wordmark}
              registering={registering}
              onRegister={enrollRound}
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
          </>
        ) : reg ? (
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

            {hasFlow ? (
              <>
                <h2 className="mt-2 font-serif text-xl font-medium text-foreground">
                  Your registration progress
                </h2>
                <p className="mt-1 mb-5 text-sm text-muted-foreground">
                  Follow the steps below to complete your entry to {config.wordmark}.
                </p>
                <Stepper
                  steps={progress!.steps}
                  externalUrl={access?.externalUrl ?? null}
                  credential={access?.credential ?? null}
                  compId={comp?.id ?? null}
                  slug={slug}
                />
              </>
            ) : (
              <>
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
              </>
            )}
          </Card>
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
    </div>
  );
}
