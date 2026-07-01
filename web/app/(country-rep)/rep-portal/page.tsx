'use client';

import Link from 'next/link';
import {
  Award,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Trophy,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { useT } from '@/lib/i18n/context';
import { StatCard } from '@/components/shell/stat-card';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { rupiah, useRepContext } from '@/hooks/use-rep-context';
import { RoundPicker, roundCategoryLabel, useRep } from '@/lib/rep/context';

interface QuickLink {
  label: string;
  href: string;
  description: string;
  icon: typeof Upload;
  external?: boolean;
}

const QUICK_LINKS: QuickLink[] = [
  {
    label: 'My Students',
    href: '/rep-portal/students',
    description: 'Review the roster for the selected round.',
    icon: Users,
  },
  {
    label: 'Bulk Registration',
    href: '/rep-portal/bulk-registration',
    description: 'Add students from a CSV file or paste them from a spreadsheet.',
    icon: Upload,
  },
  {
    label: 'Bulk Payment',
    href: '/rep-portal/bulk-payment',
    description: 'Pay one batch invoice for every unpaid student.',
    icon: CreditCard,
  },
  {
    label: 'Registrations',
    href: '/rep-portal/registrations',
    description: 'Track each registration by status.',
    icon: ClipboardList,
  },
  {
    label: 'Deadlines',
    href: '/rep-portal/deadlines',
    description: 'Exam date and outstanding action items.',
    icon: CalendarClock,
  },
  {
    label: 'Achievements',
    href: '/rep-portal/achievements',
    description: 'Review current results and historical records, then download a PDF if you need one.',
    icon: Award,
  },
];

export default function RepDashboardPage() {
  const t = useT();
  const { ctx, loading } = useRepContext();
  const { ctx: full } = useRep();
  const round = ctx?.selectedRound;
  const fullRound = full?.selectedRound ?? null;
  const accessibleCount = full?.rounds.length ?? 0;

  const students = ctx?.students ?? [];
  const total = students.length;
  const pendingPayment = students.filter((s) => s.status === 'pending_payment').length;
  const pendingReview = students.filter((s) => s.status === 'pending_review').length;
  const paid = students.filter((s) => s.status === 'paid').length;
  const medalists = students.filter((s) => s.isMedalist === true).length;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={ctx ? `${ctx.competition.name} · ${ctx.country}` : t('rep.eyebrow')}
        title={t('opnav.dashboard')}
        subtitle={t('rep.dashSubtitle')}
      />

      <RoundPicker />

      {loading ? (
        <Card className="p-6">
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : accessibleCount === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            No rounds are available yet
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            An organizer needs to publish a round for {ctx?.country ?? 'your country'} before
            you can start using this portal.
          </p>
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
              {round.examDate && (
                <span>
                  Exam date: <span className="text-foreground">{round.examDate}</span>
                </span>
              )}
            </div>
          </Card>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Registered"      value={total}          icon={Users}        accent="horizon" />
            <StatCard label="Pending payment" value={pendingPayment} icon={CreditCard}   accent="sunshine" hint={round.fee > 0 ? rupiah(round.fee * pendingPayment) : undefined} />
            <StatCard label="Pending review"  value={pendingReview}  icon={ClipboardList} accent="citrus" />
            <StatCard label="Paid"            value={paid}           icon={UserCheck}    accent="sky" />
            <StatCard label="Medalists"       value={medalists}      icon={Trophy}       accent="berry" />
          </div>

          {/* Quick links */}
          <div>
            <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Quick actions
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_LINKS.map((q) => {
                const Icon = q.icon;
                const inner = (
                  <Card className="group h-full gap-2 p-5 transition-colors hover:border-primary/40 hover:bg-accent/40">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="size-4" />
                      </span>
                      <p className="text-sm font-semibold text-foreground">{q.label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{q.description}</p>
                  </Card>
                );
                return q.external ? (
                  <a key={q.href} href={q.href} className="block">
                    {inner}
                  </a>
                ) : (
                  <Link key={q.href} href={q.href} className="block">
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Unpaid call-to-action */}
          {pendingPayment > 0 && round.fee > 0 && (
            <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/30">
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  {pendingPayment} student{pendingPayment === 1 ? '' : 's'} need to be paid for
                </p>
                <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-100/70">
                  Total {rupiah(round.fee * pendingPayment)}, settle in one Midtrans transaction.
                </p>
              </div>
              <Button asChild>
                <Link href="/rep-portal/bulk-payment">
                  <CreditCard className="size-4" />
                  Go to Bulk Payment
                </Link>
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
