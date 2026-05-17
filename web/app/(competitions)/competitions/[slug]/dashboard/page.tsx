'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RegistrationRow {
  id: string;
  compId: string;
  status: string;
  registrationNumber: string | null;
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
      return 'Complete your profile in the Competzy app to move forward.';
    case 'documents':
      return 'Upload the required documents in the Competzy app.';
    case 'payment':
      return 'Head to the Competzy app to pay your registration fee.';
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

function Stepper({
  steps,
  externalUrl,
  credential,
}: {
  steps: FlowProgressStep[];
  externalUrl: string | null;
  credential: AffiliatedCredential | null;
}) {
  return (
    <ol className="mt-1">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const hint = s.status === 'current' ? currentHint(s.checkType) : '';
        const showAccess = s.stepKey === 'external_access' && s.status !== 'upcoming';
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
  const paths = competitionPaths(slug);

  const { user, logout } = useCompetitionAuth();
  const { comp } = usePortalComp(slug);
  const router = useRouter();

  const [regs, setRegs] = useState<RegistrationRow[] | null>(null);
  const [progress, setProgress] = useState<FlowProgress | null>(null);
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [enroll, setEnroll] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  const signOut = async () => {
    await logout();
    router.replace(paths.login);
  };

  if (!config) return null;

  const hasFlow = !!progress && progress.steps.length > 0;
  const fallbackCopy = reg ? STATUS_COPY[reg.status] : null;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
              {config.shortName} 2026
            </p>
            <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">
              Hi {user?.fullName || user?.full_name || 'there'} 👋
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/competitions">All competitions</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </header>

        {err && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {err}
          </div>
        )}

        {!regs ? (
          <Card className="items-center gap-3 p-10 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading your registration…</p>
          </Card>
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
    </div>
  );
}
