'use client';

// Global "My Achievements" — every certificate the student has earned, across
// all competitions. Aggregates GET /api/certificates/mine (no compId = all).

import { useEffect, useState } from 'react';
import { Award, CheckCircle2, Loader2, Trophy } from 'lucide-react';

import { certificatesHttp } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Certificate {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  type: string;
  awardLabel: string | null;
  competitionName: string;
  grade: string | null;
  score: number | null;
  issuedAt: string;
  revokedAt: string | null;
}

function fmtDate(d: string | null): string {
  return d
    ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
}

export default function AchievementsPage() {
  const [certs, setCerts] = useState<Certificate[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    certificatesHttp
      .get<Certificate[]>('/certificates/mine')
      .then(setCerts)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load achievements'));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
          My Achievements
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Certificates you have earned across every competition.
        </p>
      </div>

      {err && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {!certs ? (
        <Card className="items-center gap-3 p-10 text-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading achievements…</p>
        </Card>
      ) : certs.length === 0 ? (
        <Card className="items-center gap-2 p-10 text-center">
          <Award className="size-7 text-muted-foreground" />
          <h2 className="font-serif text-lg font-medium text-foreground">No certificates yet</h2>
          <p className="text-sm text-muted-foreground">
            Finish a competition exam to earn your first certificate.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certs.map((c) => (
            <Card key={c.id} className={cn('gap-0 overflow-hidden p-0', c.revokedAt && 'opacity-60')}>
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
                    {c.type === 'achievement' ? <Trophy className="size-4" /> : <CheckCircle2 className="size-4" />}
                  </span>
                  <Badge variant="outline" className="border-current/30 bg-white/15 font-mono text-[10px] uppercase">
                    {c.type === 'achievement' ? 'Achievement' : 'Participation'}
                  </Badge>
                </div>
                <h2 className="mt-3 font-serif text-base font-semibold tracking-tight">
                  {c.competitionName}
                </h2>
                {c.awardLabel && <p className="mt-0.5 text-xs font-medium opacity-90">{c.awardLabel}</p>}
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Certificate
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-foreground">{c.certificateNumber}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {c.revokedAt ? 'Revoked' : `Issued ${fmtDate(c.issuedAt)}`}
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
  );
}
