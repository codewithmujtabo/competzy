'use client';

// Public competition catalog at `/competitions`. Student/parent post-login
// lands here and picks a competition; selecting one with a registered portal
// config opens `/competitions/[slug]/dashboard`. Auth-gated via the
// competition auth context (the (competitions) route-group layout has no
// guard of its own — the register page must stay reachable unauthenticated).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Loader2, Trophy } from 'lucide-react';

import { emcHttp } from '@/lib/api/client';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { getCompetitionConfig } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CatalogCompetition {
  id: string;
  slug: string | null;
  name: string;
  organizerName: string;
  category: string | null;
  gradeLevel: string | null;
  fee: number;
  regCloseDate: string | null;
  competitionDate: string | null;
}

function fmtDate(d: string | null): string {
  return d
    ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
}

function CompetitionCard({ comp }: { comp: CatalogCompetition }) {
  const hasPortal = comp.slug ? getCompetitionConfig(comp.slug) : null;

  const body = (
    <Card
      className={
        'gap-0 p-6 transition-colors ' +
        (hasPortal ? 'hover:border-primary/40 hover:bg-accent/40' : 'opacity-70')
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Trophy className="size-5" />
        </div>
        {comp.fee === 0 ? (
          <Badge
            variant="outline"
            className="border-transparent bg-emerald-100 font-mono text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          >
            Free
          </Badge>
        ) : (
          <span className="text-sm font-medium tabular-nums text-foreground">
            Rp {comp.fee.toLocaleString('id-ID')}
          </span>
        )}
      </div>

      <h2 className="mt-4 font-serif text-lg font-medium leading-snug text-foreground">
        {comp.name}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{comp.organizerName}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {comp.category && (
          <Badge variant="secondary" className="font-normal">
            {comp.category}
          </Badge>
        )}
        {comp.gradeLevel && (
          <Badge variant="outline" className="font-normal text-muted-foreground">
            {comp.gradeLevel}
          </Badge>
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
    return (
      <Link href={`/competitions/${comp.slug}/dashboard`} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

export default function CompetitionCatalogPage() {
  const { user, loading: authLoading, logout } = useCompetitionAuth();
  const router = useRouter();

  const [comps, setComps] = useState<CatalogCompetition[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    emcHttp
      .get<CatalogCompetition[]>('/competitions')
      .then(setComps)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load competitions'));
  }, [user]);

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

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-5xl space-y-8 p-6 lg:p-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">Competzy</p>
            <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">
              Hi {user.fullName || user.full_name || 'there'} 👋
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a competition to register or check your progress.
            </p>
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

        {!comps ? (
          <Card className="items-center gap-3 p-12 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading competitions…</p>
          </Card>
        ) : comps.length === 0 ? (
          <Card className="items-center gap-2 p-12 text-center">
            <Trophy className="size-7 text-muted-foreground" />
            <h2 className="font-serif text-lg font-medium text-foreground">No competitions yet</h2>
            <p className="text-sm text-muted-foreground">
              Competitions will appear here once an organizer publishes them.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {comps.map((c) => (
              <CompetitionCard key={c.id} comp={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
