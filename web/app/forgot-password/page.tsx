'use client';

// Forgot-password landing. Submits an email to POST /api/auth/forgot-password.
// Backend always returns 200 (no enumeration), so the success screen never
// confirms whether the email matched an account.

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Mail } from 'lucide-react';
import { adminHttp } from '@/lib/api/client';
import { HubAuthShell } from '@/components/hub-auth-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmit] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailValid || submitting) return;
    setError('');
    setSubmit(true);
    try {
      await adminHttp.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link. Please try again.');
    } finally {
      setSubmit(false);
    }
  };

  return (
    <HubAuthShell
      headlineTop="Forgot"
      headlineBottom="password?"
      caption="We’ll get you back in."
      quote="Enter the email you signed up with and we’ll send a link to set a new password."
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
        Competzy · Password reset
      </p>

      {sent ? (
        <>
          <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">Check your inbox.</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            If <strong className="text-foreground">{email}</strong> matches a Competzy account, we’ve
            sent a reset link there. The link is valid for <strong>15 minutes</strong>.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Didn’t get it? Check your spam folder, or{' '}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => {
                setSent(false);
                setError('');
              }}
            >
              try a different email
            </button>
            .
          </p>
          <Button asChild size="lg" className="mt-6 w-full">
            <Link href="/">
              Back to sign in
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </>
      ) : (
        <>
          <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">Reset your password.</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter your account email and we’ll send a link to set a new password.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-5 space-y-4">
            <div>
              <Label htmlFor="reset-email" className="mb-1.5 text-xs text-muted-foreground">
                Email
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
                <p className="mt-1 text-xs text-destructive">Please enter a valid email address.</p>
              )}
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={!emailValid || submitting}>
              {submitting ? 'Sending link…' : 'Send reset link'}
              {!submitting && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Remembered it?{' '}
            <Link href="/" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </HubAuthShell>
  );
}
