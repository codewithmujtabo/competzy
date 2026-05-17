'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
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

const STATUS_COPY: Record<string, { title: string; body: string; cta?: string }> = {
  pending_payment: {
    title: 'Your seat is held.',
    body: 'Complete your payment to lock in your spot.',
    cta: 'Continue to payment',
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

export default function CompetitionDashboardPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);

  const { user, logout } = useCompetitionAuth();
  const { comp } = usePortalComp(slug);
  const router = useRouter();

  const [regs, setRegs] = useState<RegistrationRow[] | null>(null);
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

  const reg = regs?.[0];
  const copy = reg ? STATUS_COPY[reg.status] : null;

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
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
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
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
              Status · {reg.status.replace(/_/g, ' ')}
            </p>
            <h2 className="mt-2 font-serif text-xl font-medium text-foreground">
              {copy?.title ?? 'Registration recorded.'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {copy?.body ?? `Status: ${reg.status}`}
            </p>
            {reg.registrationNumber && (
              <p className="mt-4 font-mono text-xs text-muted-foreground">
                Registration #&nbsp;{reg.registrationNumber}
              </p>
            )}
            {copy?.cta && (
              <Button className="mt-5 w-fit" disabled>
                {copy.cta} (wiring soon)
              </Button>
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

        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          The full participant experience (materials, sessions, certificates) is coming next.{' '}
          <Link href="/" className="font-medium text-primary hover:underline">
            Visit the Competzy hub →
          </Link>
        </div>
      </div>
    </div>
  );
}
