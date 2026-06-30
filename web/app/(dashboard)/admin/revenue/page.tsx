'use client';

// Admin revenue dashboard — reproduces the per-competition Midtrans pivot the
// finance team used to build by hand. Settled registration payments sliced by
// competition → round → payer type (Personal vs Kolektif), with transaction
// count, gross revenue, participants, and companions. CSV export + year filter.

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { Download, Wallet, Users, UserCheck, ReceiptText } from 'lucide-react';
import { adminHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import { PageHeader } from '@/components/shell/page-header';
import { StatCard } from '@/components/shell/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Row {
  compId: string;
  competition: string;
  round: string | null;
  payerType: 'Personal' | 'Kolektif';
  txnCount: number;
  revenueRp: number;
  participants: number;
  companions: number;
}
interface Totals {
  txnCount: number;
  revenueRp: number;
  participants: number;
  companions: number;
}
interface RevenueReport {
  year: number | null;
  rows: Row[];
  grandTotal: Totals;
  years: number[];
}

function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

const ZERO: Totals = { txnCount: 0, revenueRp: 0, participants: 0, companions: 0 };
const addTotals = (a: Totals, r: Row): Totals => ({
  txnCount: a.txnCount + r.txnCount,
  revenueRp: a.revenueRp + r.revenueRp,
  participants: a.participants + r.participants,
  companions: a.companions + r.companions,
});

export default function AdminRevenuePage() {
  const t = useT();
  const [data, setData] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    const q = year === 'all' ? '' : `?year=${year}`;
    adminHttp
      .get<RevenueReport>(`/admin/revenue/by-competition${q}`)
      .then(setData)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load revenue'))
      .finally(() => setLoading(false));
  }, [year]);

  // Group rows by competition (preserving API order) for subtotal sections.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; rows: Row[]; subtotal: Totals }>();
    for (const r of data?.rows ?? []) {
      const g = map.get(r.compId) ?? { name: r.competition, rows: [], subtotal: { ...ZERO } };
      g.rows.push(r);
      g.subtotal = addTotals(g.subtotal, r);
      map.set(r.compId, g);
    }
    return Array.from(map.values());
  }, [data]);

  const exportCsv = () => {
    if (!data) return;
    const head = ['Competition', 'Round', 'Type', 'Transactions', 'Revenue (Rp)', 'Participants', 'Companions'];
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [head.join(',')];
    for (const grp of groups) {
      for (const r of grp.rows) {
        lines.push(
          [r.competition, r.round ?? '', r.payerType, r.txnCount, r.revenueRp, r.participants, r.companions]
            .map(esc)
            .join(','),
        );
      }
    }
    lines.push(
      ['TOTAL', '', '', data.grandTotal.txnCount, data.grandTotal.revenueRp, data.grandTotal.participants, data.grandTotal.companions]
        .map(esc)
        .join(','),
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competzy-revenue-${year === 'all' ? 'all-years' : year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const g = data?.grandTotal ?? ZERO;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={t('adm.management')}
        title={t('opnav.revenue')}
        subtitle="Settled registration payments by competition, round, and payer type."
        actions={
          <div className="flex items-center gap-2">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {(data?.years ?? []).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv} disabled={!data || data.rows.length === 0}>
              <Download className="size-4" />
              CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="gap-0 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-8 w-28" />
            </Card>
          ))
        ) : (
          <>
            <StatCard label="Gross Revenue" value={fmtRp(g.revenueRp)} icon={Wallet} accent="green" />
            <StatCard label="Transactions" value={g.txnCount.toLocaleString('en-US')} icon={ReceiptText} accent="teal" />
            <StatCard label="Participants" value={g.participants.toLocaleString('en-US')} icon={Users} accent="indigo" />
            <StatCard label="Companions" value={g.companions.toLocaleString('en-US')} icon={UserCheck} accent="amber" />
          </>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Per competition</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Personal = paid by the student/parent · Kolektif = bulk-paid by a school or sponsor.
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead>Competition</TableHead>
                <TableHead className="w-40">Round</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-24 text-right">Txns</TableHead>
                <TableHead className="w-36 text-right">Revenue</TableHead>
                <TableHead className="w-28 text-right">Peserta</TableHead>
                <TableHead className="w-28 text-right">Pendamping</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || !data ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    No settled payments yet for this period.
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((grp) => <GroupRows key={grp.name} grp={grp} />)
              )}
            </TableBody>
          </Table>
        </div>
        {data && groups.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3 text-sm">
            <span className="font-semibold text-foreground">Grand total</span>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[13px]">
              <span>{g.txnCount} txns</span>
              <span className="font-semibold">{fmtRp(g.revenueRp)}</span>
              <span className="text-muted-foreground">{g.participants} peserta</span>
              <span className="text-muted-foreground">{g.companions} pendamping</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function GroupRows({ grp }: { grp: { name: string; rows: Row[]; subtotal: Totals } }) {
  const multi = grp.rows.length > 1;
  return (
    <>
      {grp.rows.map((r, i) => (
        <TableRow key={`${grp.name}-${r.round ?? ''}-${r.payerType}`}>
          <TableCell className="font-medium text-foreground">
            {i === 0 ? grp.name : <span className="select-none text-transparent">{grp.name}</span>}
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">{r.round ?? '—'}</TableCell>
          <TableCell>
            <Badge
              variant="outline"
              className={
                r.payerType === 'Kolektif'
                  ? 'border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200'
                  : 'border-transparent bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200'
              }
            >
              {r.payerType}
            </Badge>
          </TableCell>
          <TableCell className="text-right font-mono text-[13px] text-muted-foreground">{r.txnCount}</TableCell>
          <TableCell className="text-right font-mono text-[13px]">{fmtRp(r.revenueRp)}</TableCell>
          <TableCell className="text-right font-mono text-[13px] text-muted-foreground">{r.participants}</TableCell>
          <TableCell className="text-right font-mono text-[13px] text-muted-foreground">{r.companions}</TableCell>
        </TableRow>
      ))}
      {multi && (
        <TableRow className="bg-muted/20">
          <TableCell />
          <TableCell colSpan={2} className="text-xs font-semibold text-muted-foreground">
            {grp.name} subtotal
          </TableCell>
          <TableCell className="text-right font-mono text-[13px] font-semibold">{grp.subtotal.txnCount}</TableCell>
          <TableCell className="text-right font-mono text-[13px] font-semibold">{fmtRp(grp.subtotal.revenueRp)}</TableCell>
          <TableCell className="text-right font-mono text-[13px] font-semibold">{grp.subtotal.participants}</TableCell>
          <TableCell className="text-right font-mono text-[13px] font-semibold">{grp.subtotal.companions}</TableCell>
        </TableRow>
      )}
    </>
  );
}
