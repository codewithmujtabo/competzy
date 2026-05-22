'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { countryRepHttp } from '@/lib/api/client';
import { rupiah, useRepContext } from '@/hooks/use-rep-context';

export default function RepBulkPaymentPage() {
  const { ctx, loading, refresh } = useRepContext();
  const round = ctx?.localRound;
  const unpaid = (ctx?.students ?? []).filter((s) => s.status === 'pending_payment');

  const [paying, setPaying] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const payBatch = async () => {
    setPaying(true);
    try {
      const res = await countryRepHttp.post<{ batchId: string; redirectUrl?: string }>(
        '/rep/pay-batch',
        {},
      );
      if (res.redirectUrl) window.open(res.redirectUrl, '_blank', 'noopener');
      let tries = 0;
      pollTimer.current = setInterval(async () => {
        tries += 1;
        if (tries > 40) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setPaying(false);
          toast.message('Still waiting for the payment to settle — refresh once you finish.');
          return;
        }
        try {
          const v = await countryRepHttp.get<{ status: string }>(
            `/rep/pay-batch/${res.batchId}/verify`,
          );
          if (v.status === 'paid') {
            if (pollTimer.current) clearInterval(pollTimer.current);
            setPaying(false);
            toast.success('Payment received — your students are now registered.');
            await refresh();
          }
        } catch {
          /* transient — keep polling */
        }
      }, 4000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start the payment');
      setPaying(false);
    }
  };

  const fee = round?.fee ?? 0;
  const total = fee * unpaid.length;

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={ctx ? `${ctx.competition.name} · ${ctx.country}` : 'Country Representative'}
        title="Bulk Payment"
        subtitle="Settle one Midtrans transaction for every unpaid student in your local round."
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
            Bulk payment unlocks once a local round exists for {ctx?.country ?? 'your country'}.
          </p>
        </Card>
      ) : fee === 0 ? (
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto size-7 text-emerald-600" />
          <p className="mt-3 text-sm font-medium text-foreground">This round is free</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No payment is required — students move straight to pending review on registration.
          </p>
        </Card>
      ) : unpaid.length === 0 ? (
        <Card className="p-10 text-center">
          <CheckCircle2 className="mx-auto size-7 text-emerald-600" />
          <p className="mt-3 text-sm font-medium text-foreground">All students paid for</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing outstanding in this local round.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/rep-portal/students">View My Students</Link>
          </Button>
        </Card>
      ) : (
        <>
          {/* Summary + pay action */}
          <Card className="flex flex-wrap items-start justify-between gap-4 p-5">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
                Outstanding for {round.name}
              </p>
              <p className="mt-1 font-serif text-xl font-medium text-foreground">
                {rupiah(total)}{' '}
                <span className="text-base font-normal text-muted-foreground">
                  · {unpaid.length} student{unpaid.length === 1 ? '' : 's'} × {rupiah(fee)}
                </span>
              </p>
            </div>
            <Button onClick={payBatch} disabled={paying}>
              <CreditCard className="size-4" />
              {paying ? 'Waiting for payment…' : `Pay ${rupiah(total)}`}
            </Button>
          </Card>

          {paying && (
            <Card className="border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground">
              Finish in the new tab — this page updates automatically once the payment settles.
            </Card>
          )}

          {/* Unpaid roster */}
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1024px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-20">Grade</TableHead>
                    <TableHead className="w-32 text-right">Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unpaid.map((s) => (
                    <TableRow key={s.registrationId}>
                      <TableCell className="font-medium text-foreground">{s.fullName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                      <TableCell className="text-sm">{s.grade ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{rupiah(fee)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-3">
              <Badge variant="secondary">{unpaid.length} unpaid</Badge>
              <span className="text-sm font-medium text-foreground tabular-nums">
                Total {rupiah(total)}
              </span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
