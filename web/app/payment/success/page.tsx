'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { emcHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import { competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PaymentResult, type PayState } from '@/components/payment/payment-result';

// Midtrans redirects the browser here after the Snap flow finishes. We never
// trust the status it appends to the URL — we re-verify server-side via
// /payments/verify, which calls Midtrans's Status API and force-syncs the DB.

const SETTLED = ['paid', 'registered', 'approved', 'completed', 'pending_review'];
const MAX_TRIES = 6;

export default function PaymentSuccessPage() {
  const t = useT();
  const ridRef = useRef<string | null>(null);
  const triesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [slug, setSlug] = useState('');
  const [state, setState] = useState<PayState>('verifying');

  const runVerify = useCallback(async () => {
    const rid = ridRef.current;
    if (!rid) {
      setState('pending');
      return;
    }
    const retry = () => {
      triesRef.current += 1;
      if (triesRef.current < MAX_TRIES) {
        timerRef.current = setTimeout(() => void runVerify(), 2500);
      } else {
        setState('pending');
      }
    };
    try {
      const r = await emcHttp.get<{ status: string }>(
        `/payments/verify/${encodeURIComponent(rid)}`,
      );
      if (SETTLED.includes(r.status)) setState('success');
      else if (r.status === 'rejected') setState('failed');
      else retry(); // still pending — async methods (VA / bank) can lag
    } catch {
      retry();
    }
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    ridRef.current = p.get('registrationId');
    setSlug(p.get('slug') ?? '');
    void runVerify();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [runVerify]);

  const recheck = () => {
    triesRef.current = 0;
    setState('verifying');
    void runVerify();
  };

  const dashboardHref = slug ? competitionPaths(slug).dashboard : '/competitions';
  const payHref = slug ? competitionPaths(slug).pay : '/competitions';

  const copy: Record<PayState, { title: string; body: string }> = {
    verifying: { title: t('paySuccess.verifyingTitle'), body: t('paySuccess.verifyingBody') },
    success: { title: t('paySuccess.successTitle'), body: t('paySuccess.successBody') },
    pending: { title: t('paySuccess.pendingTitle'), body: t('paySuccess.pendingBody') },
    failed: { title: t('paySuccess.failedTitle'), body: t('paySuccess.failedBody') },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md gap-0 p-8 sm:p-10">
        <PaymentResult state={state} title={copy[state].title} body={copy[state].body}>
          {state === 'success' && (
            <>
              <Button asChild size="lg" className="w-full">
                <Link href={dashboardHref}>{t('paySuccess.goToDashboard')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href="/account/competitions">{t('paySuccess.myCompetitions')}</Link>
              </Button>
            </>
          )}
          {state === 'pending' && (
            <>
              <Button size="lg" className="w-full" onClick={recheck}>
                {t('paySuccess.checkAgain')}
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href={dashboardHref}>{t('paySuccess.goToDashboard')}</Link>
              </Button>
            </>
          )}
          {state === 'failed' && (
            <>
              <Button asChild size="lg" className="w-full">
                <Link href={payHref}>{t('paySuccess.tryAgain')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href={dashboardHref}>{t('paySuccess.goToDashboard')}</Link>
              </Button>
            </>
          )}
        </PaymentResult>
      </Card>
    </div>
  );
}
