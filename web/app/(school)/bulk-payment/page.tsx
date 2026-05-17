'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, CreditCard, Loader2, PartyPopper } from 'lucide-react';
import { schoolHttp, useSchool } from '@/lib/auth/school-context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface RegistrationRow {
  registrationId: string;
  status: string;
  student: { id: string; name: string; email?: string; grade?: string };
  competition: { id: string; name: string; fee: number };
}
interface BatchResult {
  batchId: string;
  snapToken: string;
  snapRedirectUrl: string;
  totalAmount: number;
}

function fmtRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default function BulkPaymentPage() {
  const { user, loading: authLoading } = useSchool();
  const router = useRouter();
  const filterCompId = useSearchParams().get('competitionId');

  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      let rows: RegistrationRow[] = [];
      if (user?.role === 'school_admin') {
        const query = filterCompId
          ? `/schools/registrations?status=registered&compId=${filterCompId}&limit=200`
          : '/schools/registrations?status=registered&limit=200';
        const data = await schoolHttp.get<{ registrations: RegistrationRow[] }>(query);
        rows = data.registrations ?? [];
      } else {
        const data = await schoolHttp.get<{
          competitions: {
            id: string;
            name: string;
            fee: number;
            students: { id: string; fullName: string; grade: string; status: string; registrationId: string }[];
          }[];
        }>('/teachers/my-competitions');
        for (const comp of data.competitions ?? []) {
          if (filterCompId && comp.id !== filterCompId) continue;
          for (const s of comp.students) {
            if (s.status === 'registered') {
              rows.push({
                registrationId: s.registrationId,
                status: s.status,
                student: { id: s.id, name: s.fullName, grade: s.grade },
                competition: { id: comp.id, name: comp.name, fee: comp.fee },
              });
            }
          }
        }
      }
      setRegistrations(rows);
      setSelected(new Set(rows.map((r) => r.registrationId)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [user, filterCompId]);

  useEffect(() => {
    if (!authLoading && user) loadRegistrations();
  }, [user, authLoading, loadRegistrations]);

  if (authLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || (user.role !== 'school_admin' && user.role !== 'teacher')) {
    return (
      <div className="mx-auto max-w-[900px] p-6 lg:p-8">
        <Card className="p-12 text-center">
          <p className="text-sm text-destructive">
            Access denied — a school-admin or teacher account is required.
          </p>
          <Button asChild className="mt-4">
            <Link href="/school-dashboard">Back to dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allSelected = registrations.length > 0 && selected.size === registrations.length;
  const selectedRows = registrations.filter((r) => selected.has(r.registrationId));
  const totalAmount = selectedRows.reduce((sum, r) => sum + (r.competition.fee ?? 0), 0);

  const handlePay = async () => {
    if (selected.size === 0) return;
    setPaying(true);
    try {
      const result = await schoolHttp.post<BatchResult>('/payments/school-batch', {
        registrationIds: [...selected],
      });
      setBatchResult(result);
      window.open(result.snapRedirectUrl, '_blank');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start payment');
    } finally {
      setPaying(false);
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await loadRegistrations();
      setConfirmed(true);
      setBatchResult(null);
    } finally {
      setConfirming(false);
    }
  };

  // ── Payment opened ────────────────────────────────────────────────────────
  if (batchResult) {
    return (
      <div className="mx-auto max-w-[640px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="School" title="Bulk Payment" />
        <Card className="gap-0 p-9 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CreditCard className="size-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">Payment page opened</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A Midtrans payment page opened in a new tab — {fmtRp(batchResult.totalAmount)} for{' '}
            {selectedRows.length} student{selectedRows.length === 1 ? '' : 's'}.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button variant="outline" onClick={() => window.open(batchResult.snapRedirectUrl, '_blank')}>
              Reopen payment page
            </Button>
            <Button onClick={handleConfirm} disabled={confirming}>
              {confirming ? 'Checking…' : "I've completed payment"}
            </Button>
            <Button variant="ghost" onClick={() => setBatchResult(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Payment confirmed ─────────────────────────────────────────────────────
  if (confirmed) {
    return (
      <div className="mx-auto max-w-[640px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="School" title="Bulk Payment" />
        <Card className="gap-0 p-9 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <PartyPopper className="size-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">Payment submitted</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your payment is processing. Registrations move to “paid” once Midtrans confirms.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild>
              <Link href="/school-registrations">View registrations</Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmed(false);
                loadRegistrations();
              }}
            >
              Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Registration picker ───────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="School"
        title="Bulk Payment"
        subtitle="Pay for multiple students in a single Midtrans transaction."
      />

      {loading ? (
        <Card className="p-5">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="mt-3 h-8 w-full" />
        </Card>
      ) : registrations.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="font-medium text-foreground">No pending payments</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Every registered student has been paid, or none are currently in “registered” status.
          </p>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelected(allSelected ? new Set() : new Set(registrations.map((r) => r.registrationId)))
              }
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </Button>
            <span className="font-mono text-[11px] text-muted-foreground">
              {selected.size} of {registrations.length} selected
            </span>
          </div>

          <div className="divide-y">
            {registrations.map((r) => {
              const on = selected.has(r.registrationId);
              return (
                <button
                  key={r.registrationId}
                  type="button"
                  onClick={() => toggleRow(r.registrationId)}
                  className={cn(
                    'flex w-full items-center gap-3 px-5 py-3 text-left transition-colors',
                    on ? 'bg-accent/50' : 'hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-[18px] shrink-0 items-center justify-center rounded border',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    )}
                  >
                    {on && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{r.student.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.competition.name}
                      {r.student.grade ? ` · Grade ${r.student.grade}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[13px] tabular-nums text-foreground">
                    {r.competition.fee > 0 ? (
                      fmtRp(r.competition.fee)
                    ) : (
                      <Badge variant="secondary" className="font-normal">
                        Free
                      </Badge>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-4">
            <p className="text-sm text-muted-foreground">
              {selected.size} selected ·{' '}
              <span className="font-semibold text-foreground">Total: {fmtRp(totalAmount)}</span>
            </p>
            <Button onClick={handlePay} disabled={selected.size === 0 || paying || totalAmount === 0}>
              {paying ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  <CreditCard className="size-4" />
                  Pay {fmtRp(totalAmount)} via Midtrans
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
