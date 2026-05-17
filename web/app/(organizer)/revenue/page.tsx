'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ClipboardList, Wallet } from 'lucide-react';
import { organizerHttp } from '@/lib/auth/organizer-context';
import { PageHeader } from '@/components/shell/page-header';
import { StatCard } from '@/components/shell/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RevenueData {
  totalRegistrations: number;
  paidRegistrations: number;
  totalRevenue: number;
  competitions: { id: string; name: string; registrations: number; revenue: number }[];
}

function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    organizerHttp
      .get<RevenueData>('/organizers/revenue')
      .then(setData)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load revenue'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Overview"
        title="Revenue"
        subtitle="Total revenue and registrations across all your competitions."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {loading || !data ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="gap-0 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-8 w-28" />
            </Card>
          ))
        ) : (
          <>
            <StatCard label="Total Revenue" value={fmtRp(data.totalRevenue)} icon={Wallet} accent="green" />
            <StatCard
              label="Paid Registrations"
              value={data.paidRegistrations.toLocaleString('en-US')}
              icon={CheckCircle2}
              accent="teal"
            />
            <StatCard
              label="Total Registrations"
              value={data.totalRegistrations.toLocaleString('en-US')}
              icon={ClipboardList}
              accent="indigo"
            />
          </>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Per competition</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Revenue and its share of your total.</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competition</TableHead>
                <TableHead className="text-right">Registrations</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="w-[200px] text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || !data ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data.competitions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                    No competitions yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.competitions.map((c) => {
                  const share =
                    data.totalRevenue > 0 ? Math.round((c.revenue / data.totalRevenue) * 100) : 0;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                      <TableCell className="text-right font-mono text-[13px] text-muted-foreground">
                        {c.registrations}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px]">
                        {c.revenue > 0 ? (
                          fmtRp(c.revenue)
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-emerald-100 font-mono text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          >
                            Free
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                          <span className="w-9 text-right font-mono text-[11px] text-muted-foreground">
                            {share}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
