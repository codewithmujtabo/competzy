'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Check, CheckCircle2, Loader2, Ticket, X } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface RegistrationRow {
  id: string;
  compId: string;
  status: string;
  registrationNumber: string | null;
}

interface VoucherResult {
  valid: boolean;
  message: string | null;
  originalFee: number;
  discountedFee: number | null;
}

const NON_PAYABLE = ['pending_review', 'approved', 'completed', 'paid', 'rejected'];

function rupiah(n: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}

export default function CompetitionPayPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);
  const router = useRouter();

  const { comp } = usePortalComp(slug);
  const [regs, setRegs] = useState<RegistrationRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Voucher.
  const [code, setCode] = useState('');
  const [voucher, setVoucher] = useState<VoucherResult | null>(null);
  const [checking, setChecking] = useState(false);

  // Payment.
  const [paying, setPaying] = useState(false);
  const [polling, setPolling] = useState(false);
  const [settled, setSettled] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  useEffect(() => {
    if (!comp?.id) return;
    emcHttp
      .get<RegistrationRow[]>(`/registrations?compId=${encodeURIComponent(comp.id)}`)
      .then(setRegs)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load registration'));
  }, [comp?.id]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const reg = regs?.[0];

  const applyVoucher = async () => {
    if (!reg || !code.trim()) return;
    setChecking(true);
    try {
      const r = await emcHttp.post<VoucherResult>('/payments/voucher/validate', {
        registrationId: reg.id,
        code: code.trim(),
      });
      setVoucher(r);
      if (!r.valid) toast.error(r.message ?? 'Voucher is not valid.');
      else toast.success('Voucher applied.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to check voucher');
    } finally {
      setChecking(false);
    }
  };

  const clearVoucher = () => {
    setVoucher(null);
    setCode('');
  };

  const checkStatus = useCallback(async () => {
    if (!reg) return;
    try {
      const r = await emcHttp.get<{ status: string }>(`/payments/verify/${reg.id}`);
      if (['pending_review', 'approved', 'paid', 'completed'].includes(r.status)) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setPolling(false);
        setSettled(true);
      }
    } catch {
      /* transient — keep polling */
    }
  }, [reg]);

  const pay = async () => {
    if (!reg) return;
    setPaying(true);
    setErr(null);
    try {
      const appliedCode = voucher?.valid ? code.trim() : undefined;
      const res = await emcHttp.post<{
        covered?: boolean;
        redirectUrl?: string;
      }>('/payments/snap', { registrationId: reg.id, voucherCode: appliedCode });

      if (res.covered) {
        setSettled(true);
        return;
      }
      if (res.redirectUrl) {
        window.open(res.redirectUrl, '_blank', 'noopener');
        setPolling(true);
        // Poll the verify endpoint while the student pays in the other tab.
        let tries = 0;
        pollTimer.current = setInterval(() => {
          tries += 1;
          if (tries > 40) {
            if (pollTimer.current) clearInterval(pollTimer.current);
            setPolling(false);
            return;
          }
          void checkStatus();
        }, 4000);
      } else {
        setErr('Could not start payment — please try again.');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to start payment');
    } finally {
      setPaying(false);
    }
  };

  if (!config) return null;

  const fee = voucher?.originalFee ?? comp?.fee ?? 0;
  const payable = reg && !NON_PAYABLE.includes(reg.status);
  const amountDue = voucher?.valid ? (voucher.discountedFee ?? fee) : fee;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-xl space-y-6 p-6 lg:p-10">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href={paths.dashboard}>
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </Button>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
            {config.shortName} 2026
          </p>
          <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">
            Registration payment
          </h1>
        </div>

        {err && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {err}
          </div>
        )}

        {!regs ? (
          <Card className="items-center gap-3 p-10 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading…</p>
          </Card>
        ) : settled ? (
          <Card className="items-center gap-3 p-10 text-center">
            <CheckCircle2 className="size-10 text-emerald-600" />
            <h2 className="font-serif text-xl font-medium text-foreground">Payment received</h2>
            <p className="text-sm text-muted-foreground">
              Your registration is now awaiting admin review.
            </p>
            <Button className="mt-2" onClick={() => router.replace(paths.dashboard)}>
              Back to dashboard
            </Button>
          </Card>
        ) : !reg ? (
          <Card className="gap-2 p-8 text-center">
            <h2 className="font-serif text-xl font-medium text-foreground">No registration yet</h2>
            <p className="text-sm text-muted-foreground">
              Enroll from the dashboard before paying.
            </p>
            <Button variant="outline" className="mx-auto mt-3 w-fit" asChild>
              <Link href={paths.dashboard}>Go to dashboard</Link>
            </Button>
          </Card>
        ) : !payable ? (
          <Card className="gap-2 p-8 text-center">
            <h2 className="font-serif text-xl font-medium text-foreground">
              Nothing to pay
            </h2>
            <p className="text-sm text-muted-foreground">
              This registration is{' '}
              <span className="font-medium">{reg.status.replace(/_/g, ' ')}</span> — no payment is
              due.
            </p>
            <Button variant="outline" className="mx-auto mt-3 w-fit" asChild>
              <Link href={paths.dashboard}>Back to dashboard</Link>
            </Button>
          </Card>
        ) : (
          <Card className="gap-0 p-7">
            {/* Voucher */}
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Have a voucher?
            </p>
            {voucher?.valid ? (
              <div className="mt-2 flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/40">
                <span className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
                  <Check className="size-4" />
                  <span className="font-mono">{code.trim()}</span> applied
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-emerald-700 dark:text-emerald-300"
                  onClick={clearVoucher}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="VG-001-XXXXXX"
                  className="font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyVoucher();
                  }}
                />
                <Button variant="outline" onClick={applyVoucher} disabled={checking || !code.trim()}>
                  <Ticket className="size-4" />
                  {checking ? 'Checking…' : 'Apply'}
                </Button>
              </div>
            )}
            {voucher && !voucher.valid && (
              <p className="mt-1.5 text-xs text-destructive">{voucher.message}</p>
            )}

            {/* Fee summary */}
            <div className="mt-6 space-y-1.5 border-t pt-5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Registration fee</span>
                <span className={voucher?.valid ? 'line-through' : ''}>{rupiah(fee)}</span>
              </div>
              {voucher?.valid && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                  <span>Voucher discount</span>
                  <span>− {rupiah(fee - amountDue)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 text-base font-semibold text-foreground">
                <span>Amount due</span>
                <span>{rupiah(amountDue)}</span>
              </div>
            </div>

            {polling ? (
              <div className="mt-6 rounded-md bg-primary/5 px-4 py-3 text-sm text-primary">
                <p className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Waiting for your payment to complete…
                </p>
                <p className="mt-1 text-xs text-primary/80">
                  Finish the payment in the tab that opened. This page updates automatically.
                </p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => void checkStatus()}>
                  I’ve paid — check now
                </Button>
              </div>
            ) : (
              <Button className="mt-6 w-full" size="lg" onClick={pay} disabled={paying}>
                {paying ? 'Starting payment…' : `Pay ${rupiah(amountDue)}`}
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
