'use client';

import { useMemo, useState } from 'react';
import { Award, Search } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { useT } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRepContext, type RepStudent } from '@/hooks/use-rep-context';
import { RoundPicker } from '@/lib/rep/context';

type StatusFilter = 'all' | 'pending_payment' | 'pending_review' | 'paid' | 'rejected';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',             label: 'All' },
  { value: 'pending_payment', label: 'Pending payment' },
  { value: 'pending_review',  label: 'Pending review' },
  { value: 'paid',            label: 'Paid' },
  { value: 'rejected',        label: 'Rejected' },
];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default',
  pending_payment: 'outline',
  pending_review: 'secondary',
  rejected: 'destructive',
};

function matchesStatus(s: RepStudent, f: StatusFilter): boolean {
  if (f === 'all') return true;
  return s.status === f;
}

export default function RepRegistrationsPage() {
  const t = useT();
  const { ctx, loading } = useRepContext();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: ctx?.students.length ?? 0,
      pending_payment: 0,
      pending_review: 0,
      paid: 0,
      rejected: 0,
    };
    for (const s of ctx?.students ?? []) {
      if (s.status in c) c[s.status as StatusFilter] += 1;
    }
    return c;
  }, [ctx?.students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (ctx?.students ?? [])
      .filter((s) => matchesStatus(s, filter))
      .filter(
        (s) =>
          !q ||
          s.fullName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.grade ?? '').toLowerCase().includes(q),
      );
  }, [ctx?.students, filter, search]);

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={ctx ? `${ctx.competition.name} · ${ctx.country}` : t('rep.eyebrow')}
        title={t('opnav.registrations')}
        subtitle={t('rep.regSubtitle')}
      />

      <RoundPicker />

      {loading ? (
        <Card className="p-6">
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : !ctx?.selectedRound ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Pick a round to view registrations
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Use the round picker above to choose which round's registrations to see.
          </p>
        </Card>
      ) : (
        <>
          {/* Status tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
            <TabsList className="flex flex-wrap">
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {counts[t.value]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

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
                        {counts.all === 0
                          ? 'No registrations yet.'
                          : 'No registrations match this filter.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((s) => (
                      <TableRow key={s.registrationId}>
                        <TableCell className="font-medium text-foreground">{s.fullName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                        <TableCell className="text-sm">{s.grade ?? '—'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={STATUS_VARIANT[s.status] ?? 'secondary'}
                            className="font-normal"
                          >
                            {s.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {s.score != null ? s.score : '—'}
                        </TableCell>
                        <TableCell>
                          {s.isMedalist ? (
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                              <Award className="size-4" />
                              Medal
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
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
