'use client';

import Link from 'next/link';
import { CalendarCheck, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { creatureInfo, type CreatureKey } from '@/lib/competitions/komodo-creatures';

export interface CreatureRow {
  roundId: string;
  roundName: string;
  /** 'YYYY-MM-DD'. */
  ageCutoffDate: string;
  /** Server-computed classification — null when student has no DOB or is out of bracket. */
  creature: {
    key: CreatureKey;
    name: string;
    ageRange: string;
    photoUrl: string;
    placeholder?: boolean;
    ageAtCutoff: number;
  } | null;
  /** True when the student has no DOB on file — UI prompts them to add it. */
  missingDob: boolean;
}

interface Props {
  rounds: CreatureRow[];
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Renders the student's per-round Komodo creature bracket. One hero card for
 * the primary (first) round + a compact list of the rest. Falls back to a
 * "complete your profile" CTA if the student has no DOB.
 */
export function CreatureCard({ rounds }: Props) {
  if (rounds.length === 0) return null;

  // The hero is the first round — typically Round 1, the season opener.
  const [hero, ...rest] = rounds;

  if (hero.missingDob) {
    return (
      <Card className="gap-3 overflow-hidden border-0 bg-gradient-to-br from-primary via-[#6B1AB8] to-[#7A3FC4] p-6 text-[#FFE459]">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#FFE459]/80">
            Komodo creature
          </p>
        </div>
        <h3 className="font-serif text-xl font-semibold tracking-tight">
          Add your date of birth to see your creature
        </h3>
        <p className="text-sm text-[#FFE459]/85">
          Komodo brackets students by age. Once we know your birthday, you&apos;ll
          unlock your creature for every round.
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-2 w-fit">
          <Link href="/account/profile">Complete profile</Link>
        </Button>
      </Card>
    );
  }

  return (
    <Card className="gap-4 overflow-hidden p-0">
      {/* Hero — gradient banner + creature photo + name. */}
      <div className="relative bg-gradient-to-br from-primary via-[#6B1AB8] to-[#7A3FC4] p-6 text-[#FFE459]">
        <div className="flex flex-wrap items-center gap-5">
          {hero.creature ? (
            <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-white/10 ring-2 ring-[#FFE459]/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero.creature.photoUrl}
                alt={hero.creature.name}
                className="size-full object-cover"
              />
            </div>
          ) : (
            <div className="flex size-24 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-2 ring-[#FFE459]/30">
              <Sparkles className="size-9 text-[#FFE459]/70" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#FFE459]/80">
              Komodo creature · {hero.roundName}
            </p>
            <h3 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-[#FFE459]">
              {hero.creature ? hero.creature.name : 'Out of bracket'}
            </h3>
            <p className="mt-1 text-sm text-[#FFE459]/90">
              {hero.creature ? (
                <>
                  {hero.creature.ageRange} — you&apos;ll be{' '}
                  <span className="font-semibold">{hero.creature.ageAtCutoff}</span>{' '}
                  on {fmtDate(hero.ageCutoffDate)}.
                </>
              ) : (
                <>Your age on {fmtDate(hero.ageCutoffDate)} doesn&apos;t match any Komodo bracket (0&ndash;18).</>
              )}
            </p>
            {hero.creature && (
              <p className="mt-2 text-xs text-[#FFE459]/70">
                {creatureInfo(hero.creature.key)?.tagline}
              </p>
            )}
            {hero.creature?.placeholder && (
              <p className="mt-2 text-[10px] uppercase tracking-wider text-[#FFE459]/70">
                * artwork TBD — placeholder image
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Compact per-round list. */}
      {rest.length > 0 && (
        <div className="px-6 pb-6">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Per round
          </p>
          <ul className="space-y-2">
            {rest.map((r) => (
              <li
                key={r.roundId}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{r.roundName}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarCheck className="size-3" />
                    {fmtDate(r.ageCutoffDate)}
                  </p>
                </div>
                {r.creature ? (
                  <Badge variant="secondary" className="shrink-0 font-mono uppercase tracking-wider">
                    {r.creature.name} · age {r.creature.ageAtCutoff}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 text-muted-foreground">
                    Out of bracket
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
