'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Award, Search, Upload } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { useT } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { rupiah, useRepContext } from '@/hooks/use-rep-context';
import { RoundPicker, roundCategoryLabel, useRep } from '@/lib/rep/context';

export default function RepStudentsPage() {
  const t = useT();
  const { ctx, loading } = useRepContext();
  const { ctx: full } = useRep();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ctx?.students ?? [];
    return (ctx?.students ?? []).filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.grade ?? '').toLowerCase().includes(q),
    );
  }, [ctx?.students, search]);

  const round = ctx?.selectedRound;
  const fullRound = full?.selectedRound ?? null;

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={ctx ? `${ctx.competition.name} · ${ctx.country}` : t('rep.eyebrow')}
        title={t('opnav.myStudents')}
        subtitle={t('rep.studentsSubtitle')}
        actions={
          round ? (
            <Button asChild>
              <Link href="/rep-portal/bulk-registration">
                <Upload className="size-4" />
                Add students
              </Link>
            </Button>
          ) : undefined
        }
      />

      <RoundPicker />

      {loading ? (
        <Card className="p-6">
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : !round ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Pick a round to get started
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Use the round picker above to choose which round you want to manage.
          </p>
        </Card>
      ) : (
        <>
          {/* Round summary */}
          <Card className="gap-0 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
              {roundCategoryLabel(fullRound?.category ?? null)}
              {fullRound?.category === 'local' && fullRound?.country ? ` · ${fullRound.country}` : ''}
            </p>
            <h2 className="mt-1 font-serif text-xl font-medium text-foreground">{round.name}</h2>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
              <span>
                Exam: <span className="text-foreground">{round.examMode}</span>
              </span>
              <span>
                Fee:{' '}
                <span className="text-foreground">
                  {round.fee > 0 ? rupiah(round.fee) : 'Free'}
                </span>
              </span>
              {round.qualifyingScore != null && (
                <span>
                  Medal score: <span className="text-foreground">≥ {round.qualifyingScore}</span>
                </span>
              )}
              <span>
                Students: <span className="text-foreground">{ctx?.students.length ?? 0}</span>
              </span>
            </div>
          </Card>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or grade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1024px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-20">Grade</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-20">Score</TableHead>
                    <TableHead className="w-24">Medal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                        {ctx?.students.length === 0
                          ? 'No students yet. Use “Add students” to register them.'
                          : 'No students match your search.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((s) => (
                      <TableRow key={s.registrationId}>
                        <TableCell className="font-medium text-foreground">{s.fullName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                        <TableCell className="text-sm">{s.grade ?? '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {s.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {s.score != null ? s.score : '-'}
                        </TableCell>
                        <TableCell>
                          {s.isMedalist ? (
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                              <Award className="size-4" />
                              Medal
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
