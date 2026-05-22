'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Award, Download, Trophy } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { countryRepHttp } from '@/lib/api/client';

interface CurrentRow {
  fullName: string;
  score: number | null;
  isMedalist: boolean | null;
  status: string;
}

interface HistoricalRow {
  fullName: string;
  compName: string | null;
  compYear: number | null;
  result: string | null;
  eventPart: string | null;
}

interface AchievementPayload {
  country: string;
  competition: { id: string; name: string };
  repName: string;
  localRound: {
    id: string;
    name: string;
    examMode: string;
    qualifyingScore: number | null;
    examDate: string | null;
  } | null;
  summary: { scored: number; medalists: number; historical: number };
  currentCohort: CurrentRow[];
  historical: HistoricalRow[];
}

export default function RepAchievementsPage() {
  const [data, setData] = useState<AchievementPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await countryRepHttp.get<AchievementPayload>('/rep/achievements');
        if (alive) setData(r);
      } catch (e) {
        if (alive) toast.error(e instanceof Error ? e.message : 'Failed to load achievements');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const round = data?.localRound;
  const empty =
    !loading &&
    data &&
    data.currentCohort.length === 0 &&
    data.historical.length === 0;

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={data ? `${data.competition.name} · ${data.country}` : 'Country Representative'}
        title="Achievements"
        subtitle="Current-cohort results and historical Competzy records for the students in your local round."
        actions={
          data ? (
            <Button asChild>
              <a href="/api/rep/export/achievement.pdf" download>
                <Download className="size-4" />
                Download PDF
              </a>
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Card className="p-6">
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : !round ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Your local round hasn’t been set up yet
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Achievements appear here once an organizer creates a local round for{' '}
            {data?.country ?? 'your country'}.
          </p>
        </Card>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="gap-2 p-5">
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  <Award className="size-4" />
                </span>
                <span className="font-serif text-2xl font-medium text-foreground">
                  {data!.summary.scored}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground">Scored</p>
              <p className="text-xs text-muted-foreground">
                Students from the current cohort with an imported exam score.
              </p>
            </Card>

            <Card className="gap-2 p-5">
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <Trophy className="size-4" />
                </span>
                <span className="font-serif text-2xl font-medium text-foreground">
                  {data!.summary.medalists}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground">Medalists</p>
              <p className="text-xs text-muted-foreground">
                Qualifying for the Global Round
                {round.qualifyingScore != null && ` (≥ ${round.qualifyingScore})`}.
              </p>
            </Card>

            <Card className="gap-2 p-5">
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Award className="size-4" />
                </span>
                <span className="font-serif text-2xl font-medium text-foreground">
                  {data!.summary.historical}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground">Historical claims</p>
              <p className="text-xs text-muted-foreground">
                Prior Competzy records claimed by these students.
              </p>
            </Card>
          </div>

          {empty ? (
            <Card className="p-10 text-center">
              <Trophy className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">No achievements yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Scores appear here as soon as you import them on the Dashboard, and historical
                Competzy records show up automatically when your students claim them.
              </p>
            </Card>
          ) : (
            <>
              {/* Current cohort */}
              <Card className="gap-3 overflow-hidden p-0">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
                      Current cohort
                    </p>
                    <h2 className="mt-0.5 font-serif text-lg font-medium text-foreground">
                      {round.name}
                    </h2>
                  </div>
                  <Badge variant="secondary">
                    {data!.currentCohort.length} scored
                  </Badge>
                </div>
                {data!.currentCohort.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No scored results yet for the current cohort.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[760px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead className="w-24">Score</TableHead>
                          <TableHead className="w-32">Medal</TableHead>
                          <TableHead className="w-32">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data!.currentCohort.map((r, i) => (
                          <TableRow key={`${r.fullName}-${i}`}>
                            <TableCell className="font-medium text-foreground">
                              {r.fullName}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {r.score != null ? r.score : '—'}
                            </TableCell>
                            <TableCell>
                              {r.isMedalist ? (
                                <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                                  <Trophy className="size-4" />
                                  Medal
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal">
                                {r.status.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>

              {/* Historical claims */}
              <Card className="gap-3 overflow-hidden p-0">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
                      Historical records
                    </p>
                    <h2 className="mt-0.5 font-serif text-lg font-medium text-foreground">
                      Prior achievements
                    </h2>
                  </div>
                  <Badge variant="secondary">{data!.historical.length} claim(s)</Badge>
                </div>
                {data!.historical.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    None of these students have claimed historical Competzy records.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Competition</TableHead>
                          <TableHead className="w-20">Year</TableHead>
                          <TableHead className="w-32">Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data!.historical.map((r, i) => (
                          <TableRow key={`${r.fullName}-${i}`}>
                            <TableCell className="font-medium text-foreground">
                              {r.fullName}
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.compName ?? '—'}
                              {r.eventPart && (
                                <span className="text-muted-foreground"> ({r.eventPart})</span>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums text-sm">
                              {r.compYear ?? '—'}
                            </TableCell>
                            <TableCell className="text-sm uppercase tracking-wide">
                              {r.result ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
