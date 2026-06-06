'use client';

// Public certificate verification page (EMC Wave 12 Phase 4).
// Route-group-free — no auth provider, reachable by anyone. The QR code on a
// certificate PDF points here. The `code` in the URL is the only credential.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Award, CheckCircle2, Download, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { useT, useLocale } from '@/lib/i18n/context';

interface VerifyResult {
  valid: boolean;
  revoked: boolean;
  type: string;
  awardLabel: string | null;
  studentName: string;
  competitionName: string;
  grade: string | null;
  score: number | null;
  scoreMax: number | null;
  certificateNumber: string;
  issuedAt: string;
}

type State = 'loading' | 'ok' | 'notfound' | 'error';

export default function VerifyCertificatePage() {
  const t = useT();
  const { locale } = useLocale();
  const params = useParams<{ code: string }>();
  const code = params?.code ?? '';
  const [state, setState] = useState<State>('loading');
  const [cert, setCert] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/certificates/verify/${encodeURIComponent(code)}`)
      .then(async (res) => {
        if (res.status === 404) {
          setState('notfound');
          return;
        }
        if (!res.ok) {
          setState('error');
          return;
        }
        setCert((await res.json()) as VerifyResult);
        setState('ok');
      })
      .catch(() => setState('error'));
  }, [code]);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-lg px-6 py-12">
        <p className="text-center font-mono text-xs uppercase tracking-[0.22em] text-primary">
          Competzy
        </p>
        <h1 className="mt-1 text-center font-serif text-2xl font-medium text-foreground">
          {t('vfy.title')}
        </h1>

        <div className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
          {state === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-sm">{t('vfy.checking')}</span>
            </div>
          )}

          {state === 'notfound' && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <XCircle className="size-9 text-destructive" />
              <h2 className="font-serif text-lg font-medium text-foreground">{t('vfy.notFound')}</h2>
              <p className="text-sm text-muted-foreground">{t('vfy.notFoundHint')}</p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <ShieldAlert className="size-9 text-muted-foreground" />
              <h2 className="font-serif text-lg font-medium text-foreground">{t('vfy.unavailable')}</h2>
              <p className="text-sm text-muted-foreground">{t('vfy.unavailableHint')}</p>
            </div>
          )}

          {state === 'ok' && cert && (
            <>
              {cert.revoked ? (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                  <ShieldAlert className="size-4 shrink-0" />
                  <span className="text-sm font-medium">{t('vfy.revoked')}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span className="text-sm font-medium">{t('vfy.valid')}</span>
                </div>
              )}

              <div className="mt-5 flex items-center gap-2 text-primary">
                <Award className="size-4" />
                <p className="font-medium">
                  {cert.type === 'achievement' ? t('vfy.achievement') : t('vfy.participation')}
                </p>
              </div>

              <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2.5 text-sm">
                <dt className="text-muted-foreground">{t('vfy.awardedTo')}</dt>
                <dd className="font-medium text-foreground">{cert.studentName}</dd>
                <dt className="text-muted-foreground">{t('vfy.competition')}</dt>
                <dd className="text-foreground">{cert.competitionName}</dd>
                {cert.awardLabel && (
                  <>
                    <dt className="text-muted-foreground">{t('vfy.award')}</dt>
                    <dd className="font-medium text-foreground">{cert.awardLabel}</dd>
                  </>
                )}
                {cert.grade && (
                  <>
                    <dt className="text-muted-foreground">{t('vfy.grade')}</dt>
                    <dd className="text-foreground">{cert.grade}</dd>
                  </>
                )}
                {cert.score != null && (
                  <>
                    <dt className="text-muted-foreground">{t('vfy.score')}</dt>
                    <dd className="text-foreground">
                      {cert.score}
                      {cert.scoreMax != null ? ` / ${cert.scoreMax}` : ''}
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">{t('vfy.issued')}</dt>
                <dd className="text-foreground">
                  {new Date(cert.issuedAt).toLocaleDateString(locale === 'id' ? 'id-ID' : 'en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </dd>
                <dt className="text-muted-foreground">{t('vfy.number')}</dt>
                <dd className="font-mono text-xs text-foreground">{cert.certificateNumber}</dd>
              </dl>

              <a
                href={`/api/certificates/verify/${encodeURIComponent(code)}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Download className="size-4" />
                {t('vfy.downloadPdf')}
              </a>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t('vfy.verifiedBy')}{' '}
          <Link href="/" className="text-primary hover:underline">
            Competzy
          </Link>
        </p>
      </div>
    </div>
  );
}
