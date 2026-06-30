'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2, Ticket, X } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import type { MessageKey } from '@/lib/i18n/messages/en';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PaymentResult } from '@/components/payment/payment-result';

interface RegistrationRow {
  id: string;
  compId: string;
  roundId: string | null;
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
  const t = useT();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);
  const router = useRouter();

  const { comp } = usePortalComp(slug);
  const [regs, setRegs] = useState<RegistrationRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // The specific registration to pay (a round registration), from ?registrationId=.
  const [targetRegId, setTargetRegId] = useState<string | null>(null);
  // round id → { fee, feeInternational, name } for a multi-round competition.
  const [roundInfo, setRoundInfo] = useState<
    Record<string, { fee: number; feeInternational: number | null; name: string }>
  >({});
  // USD → IDR rate served by GET /competitions/:id. Mirrors backend env so an
  // international student's "Rp X (~$Y USD)" label matches what Midtrans charges.
  const [usdRate, setUsdRate] = useState<number>(16000);
  const [userCountry, setUserCountry] = useState<string | null>(null);

  // Voucher.
  const [code, setCode] = useState('');
  const [voucher, setVoucher] = useState<VoucherResult | null>(null);
  const [checking, setChecking] = useState(false);

  // Payment. After Snap we full-page redirect to /payment/success, which
  // verifies + animates the outcome — so the only inline state we keep is
  // `settled`, shown when a voucher fully covers the fee (no Midtrans hop).
  const [paying, setPaying] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setTargetRegId(p.get('registrationId'));
  }, []);

  // Load the caller's country to decide local vs international display.
  useEffect(() => {
    emcHttp
      .get<{ country: string | null }>('/users/me')
      .then((me) => setUserCountry(me.country ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!comp?.id) return;
    emcHttp
      .get<RegistrationRow[]>(`/registrations?compId=${encodeURIComponent(comp.id)}`)
      .then(setRegs)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load registration'));
    emcHttp
      .get<{
        usdToIdrRate?: number;
        rounds?: {
          id: string;
          fee: number;
          feeInternational: number | null;
          roundName: string;
        }[];
      }>(`/competitions/${comp.id}`)
      .then((d) => {
        if (d.usdToIdrRate && Number.isFinite(d.usdToIdrRate)) setUsdRate(Number(d.usdToIdrRate));
        const m: Record<string, { fee: number; feeInternational: number | null; name: string }> = {};
        for (const r of d.rounds ?? []) {
          m[r.id] = {
            fee: Number(r.fee) || 0,
            feeInternational:
              r.feeInternational != null ? Number(r.feeInternational) : null,
            name: r.roundName,
          };
        }
        setRoundInfo(m);
      })
      .catch(() => {});
  }, [comp?.id]);

  // Pay the registration named in ?registrationId=, else the first payable one.
  const reg = regs
    ? (targetRegId
        ? regs.find((r) => r.id === targetRegId)
        : regs.find((r) => !NON_PAYABLE.includes(r.status)) ?? regs[0])
    : undefined;
  const round = reg?.roundId ? roundInfo[reg.roundId] : undefined;

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

  const pay = async () => {
    if (!reg) return;
    setPaying(true);
    setErr(null);
    try {
      const appliedCode = voucher?.valid ? code.trim() : undefined;
      // Where Midtrans sends the browser back after payment — our animated
      // success page, which re-verifies the real status. Built from the current
      // origin so it works in dev (localhost) + prod (arena.competzy.com); the
      // backend allowlists the origin before handing it to Midtrans.
      const returnUrl = `${window.location.origin}/payment/success?registrationId=${encodeURIComponent(
        reg.id,
      )}&slug=${encodeURIComponent(slug)}`;
      const res = await emcHttp.post<{
        covered?: boolean;
        redirectUrl?: string;
      }>('/payments/snap', { registrationId: reg.id, voucherCode: appliedCode, returnUrl });

      if (res.covered) {
        // A voucher covered the whole fee — settled server-side, no Midtrans hop.
        setSettled(true);
        return;
      }
      if (res.redirectUrl) {
        // Full-page redirect into Snap; Midtrans returns to /payment/success.
        window.location.assign(res.redirectUrl);
        return;
      }
      setErr('Could not start payment — please try again.');
      setPaying(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to start payment');
      setPaying(false);
    }
  };

  if (!config) return null;

  // International student on a round with a USD price → charge the IDR
  // equivalent via Midtrans (their card issuer handles local conversion at
  // point of sale). Indonesian students see the round's IDR fee directly.
  const isIntl = !!userCountry && userCountry.toUpperCase() !== 'ID';
  const usdPrice = round?.feeInternational ?? null;
  const baseFee =
    isIntl && usdPrice != null && usdPrice > 0
      ? Math.round(usdPrice * usdRate)
      : (round ? round.fee : comp?.fee ?? 0);
  const fee = voucher?.originalFee ?? baseFee;
  const payable = reg && !NON_PAYABLE.includes(reg.status);
  const amountDue = voucher?.valid ? (voucher.discountedFee ?? fee) : fee;
  const usdEquivalent = isIntl && usdPrice != null && usdPrice > 0 ? usdPrice : null;
  // Always rupiah (Midtrans charges in IDR). For international students, the
  // call sites pair this with a "(~$X USD)" suffix.
  const formatAmount = (n: number) => rupiah(n);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-xl space-y-6 p-6 lg:p-10">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href={paths.dashboard}>
            <ArrowLeft className="size-4" />
            {t('pay.back')}
          </Link>
        </Button>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
            {config.shortName} 2026
          </p>
          <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">
            {round ? t('pay.headerRound', { round: round.name }) : t('pay.headerTitle')}
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
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          </Card>
        ) : settled ? (
          <Card className="gap-0 p-8 sm:p-10">
            <PaymentResult
              state="success"
              title={t('paySuccess.successTitle')}
              body={t('paySuccess.successBody')}
            >
              <Button className="w-full" size="lg" onClick={() => router.replace(paths.dashboard)}>
                {t('paySuccess.goToDashboard')}
              </Button>
            </PaymentResult>
          </Card>
        ) : !reg ? (
          <Card className="gap-2 p-8 text-center">
            <h2 className="font-serif text-xl font-medium text-foreground">{t('pay.noReg')}</h2>
            <p className="text-sm text-muted-foreground">{t('pay.noRegBody')}</p>
            <Button variant="outline" className="mx-auto mt-3 w-fit" asChild>
              <Link href={paths.dashboard}>{t('pay.goToDashboard')}</Link>
            </Button>
          </Card>
        ) : !payable ? (
          <Card className="gap-2 p-8 text-center">
            <h2 className="font-serif text-xl font-medium text-foreground">{t('pay.nothingTitle')}</h2>
            <p className="text-sm text-muted-foreground">
              {t(`status.${reg.status}` as MessageKey)}
            </p>
            <Button variant="outline" className="mx-auto mt-3 w-fit" asChild>
              <Link href={paths.dashboard}>{t('pay.back')}</Link>
            </Button>
          </Card>
        ) : (
          <Card className="gap-0 p-7">
            {/* Voucher */}
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {t('pay.voucherTitle')}
            </p>
            {voucher?.valid ? (
              <div className="mt-2 flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/40">
                <span className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-200">
                  <Check className="size-4" />
                  <span className="font-mono">{code.trim()}</span>
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
                  placeholder={t('pay.voucherPlaceholder')}
                  className="font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyVoucher();
                  }}
                />
                <Button variant="outline" onClick={applyVoucher} disabled={checking || !code.trim()}>
                  <Ticket className="size-4" />
                  {checking ? t('pay.checking') : t('pay.apply')}
                </Button>
              </div>
            )}
            {voucher && !voucher.valid && (
              <p className="mt-1.5 text-xs text-destructive">{voucher.message}</p>
            )}

            {/* Fee summary */}
            <div className="mt-6 space-y-1.5 border-t pt-5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t('pay.summaryFee')}</span>
                <span className={voucher?.valid ? 'line-through' : ''}>{formatAmount(fee)}</span>
              </div>
              {voucher?.valid && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                  <span>{t('pay.summaryDiscount')}</span>
                  <span>− {formatAmount(fee - amountDue)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 text-base font-semibold text-foreground">
                <span>{t('pay.summaryDue')}</span>
                <span>{formatAmount(amountDue)}</span>
              </div>
            </div>

            <Button className="mt-6 w-full" size="lg" onClick={pay} disabled={paying}>
              {paying
                ? t('pay.starting')
                : usdEquivalent != null
                  ? `${t('dashboard.pay', { amount: formatAmount(amountDue) })} (~$${usdEquivalent} USD)`
                  : t('dashboard.pay', { amount: formatAmount(amountDue) })}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
