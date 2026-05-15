'use client';

// Reset-password landing. Reads ?token=… from the URL, submits to
// POST /api/auth/reset-password. Token is single-use server-side; the client
// just validates length + match and trusts the backend's verdict.

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, Lock } from 'lucide-react';
import { adminHttp } from '@/lib/api/client';
import { HubAuthShell } from '@/components/hub-auth-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

function ResetPasswordInner() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

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
      setTimeout(() => router.replace('/'), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password. Please try again.');
    } finally {
      setSubmit(false);
    }
  };

  return (
    <HubAuthShell
      headlineTop="Set a new"
      headlineBottom="password."
      caption="Almost there."
      quote="Choose a password at least 8 characters long. We’ll sign you in next."
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
        Competzy · Password reset
      </p>

      {!token ? (
        <>
          <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">Link is missing.</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This page needs a reset token in the URL. The link in your email should bring you here
            automatically.
          </p>
          <Button asChild size="lg" className="mt-6 w-full">
            <Link href="/forgot-password">
              Request a new link
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </>
      ) : done ? (
        <>
          <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">Password updated.</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            You can sign in with the new password now. Redirecting to sign-in…
          </p>
          <Button asChild size="lg" className="mt-6 w-full">
            <Link href="/">
              Sign in now
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </>
      ) : (
        <>
          <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">
            Choose a new password.
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Minimum 8 characters. Use something you don’t use elsewhere.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-5 space-y-4">
            <div>
              <Label htmlFor="reset-pwd" className="mb-1.5 text-xs text-muted-foreground">
                New password
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
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {tooShort && (
                <p className="mt-1 text-xs text-destructive">Password must be at least 8 characters.</p>
              )}
            </div>

            <div>
              <Label htmlFor="reset-confirm" className="mb-1.5 text-xs text-muted-foreground">
                Confirm password
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
              {mismatch && <p className="mt-1 text-xs text-destructive">Passwords don’t match.</p>}
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
              {submitting ? 'Updating…' : 'Update password'}
              {!submitting && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            <Link href="/" className="font-medium text-primary hover:underline">
              Back to sign in
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
