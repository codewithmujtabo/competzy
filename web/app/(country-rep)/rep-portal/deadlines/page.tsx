'use client';

import Link from 'next/link';
import { CalendarClock, ClipboardList, CreditCard, Trophy, Upload } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { useT } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { rupiah, useRepContext } from '@/hooks/use-rep-context';
import { RoundPicker } from '@/lib/rep/context';

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const exam = new Date(dateStr).getTime();
  if (!Number.isFinite(exam)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((exam - today.getTime()) / 86_400_000);
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function RepDeadlinesPage() {
  const t = useT();
  const { ctx, loading } = useRepContext();
  const round = ctx?.selectedRound;
  const students = ctx?.students ?? [];

  const pendingPayment = students.filter((s) => s.status === 'pending_payment').length;
  const pendingReview = students.filter((s) => s.status === 'pending_review').length;
  const scored = students.filter((s) => s.score != null).length;
  const awaitingScore = students.filter(
    (s) => (s.status === 'paid' || s.status === 'pending_review') && s.score == null,
  ).length;

  const days = daysUntil(round?.examDate ?? null);

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={ctx ? `${ctx.competition.name} · ${ctx.country}` : t('rep.eyebrow')}
        title={t('opnav.deadlines')}
        subtitle={t('rep.deadlinesSubtitle')}
      />

      <RoundPicker />

      {loading ? (
        <Card className="p-6">
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : !round ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Pick a round to view deadlines
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Use the round picker above to choose which round's schedule to see.
          </p>
        </Card>
      ) : (
        <>
          {/* Exam date card */}
          <Card className="gap-0 p-6">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CalendarClock className="size-5" />
              </span>
              <div className="flex-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
                  Exam date
                </p>
                <p className="mt-1 font-serif text-2xl font-medium text-foreground">
                  {fmtDate(round.examDate)}
                </p>
                {days != null && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {days > 0
                      ? `${days} day${days === 1 ? '' : 's'} away`
                      : days === 0
                        ? 'Today'
                        : `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`}
                    {' · '}
                    {round.examMode}
                  </p>
                )}
              </div>
              {round.examDate && days != null && days >= 0 && days <= 7 && (
                <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  {days === 0 ? 'Today' : `${days}d left`}
                </Badge>
              )}
            </div>
          </Card>

          {/* Action items */}
          <div>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Outstanding
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card className="gap-2 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    <CreditCard className="size-4" />
                  </span>
                  <span className="font-serif text-2xl font-medium text-foreground">
                    {pendingPayment}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">Awaiting payment</p>
                <p className="text-xs text-muted-foreground">
                  {pendingPayment > 0 && round.fee > 0
                    ? `Owed: ${rupiah(round.fee * pendingPayment)}, settle one batch invoice.`
                    : 'Every student is settled.'}
                </p>
                {pendingPayment > 0 && round.fee > 0 && (
                  <Button asChild variant="outline" size="sm" className="mt-2 w-fit">
                    <Link href="/rep-portal/bulk-payment">Go to Bulk Payment</Link>
                  </Button>
                )}
              </Card>

              <Card className="gap-2 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                    <ClipboardList className="size-4" />
                  </span>
                  <span className="font-serif text-2xl font-medium text-foreground">
                    {awaitingScore}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">Awaiting score</p>
                <p className="text-xs text-muted-foreground">
                  {awaitingScore > 0
                    ? 'After the offline exam, import each student\'s score on the Dashboard.'
                    : 'Every paid student already has a score.'}
                </p>
              </Card>

              <Card className="gap-2 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <Trophy className="size-4" />
                  </span>
                  <span className="font-serif text-2xl font-medium text-foreground">
                    {scored}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">Scored students</p>
                <p className="text-xs text-muted-foreground">
                  Of which {students.filter((s) => s.isMedalist === true).length} qualify for the
                  Global Round
                  {round.qualifyingScore != null && ` (≥ ${round.qualifyingScore})`}.
                </p>
              </Card>

              <Card className="gap-2 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Upload className="size-4" />
                  </span>
                  <span className="font-serif text-2xl font-medium text-foreground">
                    {pendingReview}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">Pending review</p>
                <p className="text-xs text-muted-foreground">
                  Paid (or free-round) students currently awaiting an organizer check.
                </p>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
