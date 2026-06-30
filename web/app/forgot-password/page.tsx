'use client';

// Forgot-password landing. Submits an email to POST /api/auth/forgot-password.
// Backend always returns 200 (no enumeration), so the success screen never
// confirms whether the email matched an account.

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import { adminHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import { HubAuthShell } from '@/components/hub-auth-shell';
import { competitionPaths, competitionRegistry } from '@/lib/competitions/registry';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

function readSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('comp');
  if (!raw) return null;
  const slug = raw.trim().toLowerCase();
  return slug in competitionRegistry ? slug : null;
}

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [submitting, setSubmit] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    setSlug(readSlugFromUrl());
  }, []);

  // `slug` is kept purely so back-to-signin preserves the `?comp=` param —
  // post-auth still routes the student/parent back to the right competition.
  const signInHref = slug ? competitionPaths(slug).login : '/';

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailValid || submitting) return;
    setError('');
    setSubmit(true);
    try {
      // Send our own origin so the backend builds the reset link on THIS domain
      // (the /api proxy can hide the browser Origin from the backend, and the
      // backend's APP_URL may be misconfigured). Backend host-allowlists it.
      await adminHttp.post('/auth/forgot-password', {
        email,
        resetBase: window.location.origin,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('fpw.errorDefault'));
    } finally {
      setSubmit(false);
    }
  };

  return (
    <HubAuthShell>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
        {t('fpw.eyebrow')}
      </p>

      {sent ? (
        <>
          <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">{t('fpw.sentTitle')}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {t('fpw.sentBodyPre')}
            <strong className="text-foreground">{email}</strong>
            {t('fpw.sentBodyPost')}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('fpw.sentSpamPre')}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setSent(false);
                setError('');
              }}
            >
              {t('fpw.sentSpamLink')}
            </button>
            .
          </p>
          <Button asChild size="lg" className="mt-6 w-full">
            <Link href={signInHref}>
              {t('fpw.backToSignIn')}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </>
      ) : (
        <>
          <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">{t('fpw.resetTitle')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('fpw.resetSubtitle')}</p>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-5 space-y-4">
            <div>
              <Label htmlFor="reset-email" className="mb-1.5 text-xs text-muted-foreground">
                {t('fpw.email')}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  className="pl-9"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  aria-invalid={email.length > 0 && !emailValid}
                />
              </div>
              {email.length > 0 && !emailValid && (
                <p className="mt-1 text-xs text-destructive">{t('fpw.emailInvalid')}</p>
              )}
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={!emailValid || submitting}>
              {submitting ? t('fpw.sending') : t('fpw.sendLink')}
              {!submitting && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {t('fpw.remembered')}
            <Link href={signInHref} className="font-medium text-primary hover:underline">
              {t('fpw.backToSignIn')}
            </Link>
          </p>
        </>
      )}
    </HubAuthShell>
  );
}
