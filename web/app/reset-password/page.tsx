'use client';

// Reset-password landing. Reads ?token=… from the URL, submits to
// POST /api/auth/reset-password. Token is single-use server-side; the client
// just validates length + match and trusts the backend's verdict.

import { Suspense, useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';
import { adminHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import { HubAuthShell } from '@/components/hub-auth-shell';
import { competitionPaths, competitionRegistry } from '@/lib/competitions/registry';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

function ResetPasswordInner() {
  const t = useT();
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const rawComp = search.get('comp');
  // `slug` is kept purely so back-to-signin preserves the `?comp=` param —
  // post-auth still routes the student/parent back to the right competition.
  const slug = useMemo(() => {
    if (!rawComp) return null;
    const s = rawComp.trim().toLowerCase();
    return s in competitionRegistry ? s : null;
  }, [rawComp]);
  const signInHref = slug ? competitionPaths(slug).login : '/';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmit] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = !!token && password.length >= 8 && confirm === password && !submitting;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setSubmit(true);
    try {
      await adminHttp.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => router.replace(signInHref), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('rpw.errorDefault'));
    } finally {
      setSubmit(false);
    }
  };

  return (
    <HubAuthShell
      headlineTop={t('rpw.headlineTop')}
      headlineBottom={t('rpw.headlineBottom')}
      caption={t('rpw.caption')}
      quote={t('rpw.quote')}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
        {t('fpw.eyebrow')}
      </p>

      {!token ? (
        <>
          <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">{t('rpw.missingTitle')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('rpw.missingBody')}</p>
          <Button asChild size="lg" className="mt-6 w-full">
            <Link href={slug ? competitionPaths(slug).forgotPassword : '/forgot-password'}>
              {t('rpw.requestNew')}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </>
      ) : done ? (
        <>
          <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">{t('rpw.doneTitle')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('rpw.doneBody')}</p>
          <Button asChild size="lg" className="mt-6 w-full">
            <Link href={signInHref}>
              {t('rpw.signInNow')}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </>
      ) : (
        <>
          <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">{t('rpw.chooseTitle')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('rpw.chooseSubtitle')}</p>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-5 space-y-4">
            <div>
              <Label htmlFor="reset-pwd" className="mb-1.5 text-xs text-muted-foreground">
                {t('rpw.newPassword')}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-pwd"
                  type={showPwd ? 'text' : 'password'}
                  className="px-9"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                  aria-invalid={tooShort}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? t('rpw.hidePassword') : t('rpw.showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {tooShort && (
                <p className="mt-1 text-xs text-destructive">{t('rpw.tooShort')}</p>
              )}
            </div>

            <div>
              <Label htmlFor="reset-confirm" className="mb-1.5 text-xs text-muted-foreground">
                {t('rpw.confirmPassword')}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-confirm"
                  type={showPwd ? 'text' : 'password'}
                  className="pl-9"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  aria-invalid={mismatch}
                />
              </div>
              {mismatch && <p className="mt-1 text-xs text-destructive">{t('rpw.mismatch')}</p>}
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
              {submitting ? t('rpw.updating') : t('rpw.updatePassword')}
              {!submitting && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            <Link href={signInHref} className="font-medium text-primary hover:underline">
              {t('rpw.backToSignIn')}
            </Link>
          </p>
        </>
      )}
    </HubAuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
