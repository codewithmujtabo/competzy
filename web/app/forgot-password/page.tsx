'use client';

// Forgot-password landing. Submits an email to POST /api/auth/forgot-password.
// Backend always returns 200 (no enumeration), so the success screen never
// confirms whether the email matched an account — it just says "if it exists
// you'll get a link".

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { adminHttp } from '@/lib/api/client';
import { useTheme } from '@/lib/theme/context';
import {
  MailIcon, ArrowRightIcon,
} from '@/components/competition-portal/icons';

export default function ForgotPasswordPage() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  const [email, setEmail]         = useState('');
  const [submitting, setSubmit]   = useState(false);
  const [sent, setSent]           = useState(false);
  const [error, setError]         = useState('');

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailValid || submitting) return;
    setError(''); setSubmit(true);
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
    <div className="auth-split hub-split" style={{ ['--portal-accent' as string]: '#0d7377' }}>
      <div
        className="brand-panel"
        style={{ background: 'linear-gradient(135deg,#0d7377 0%,#14a085 60%,#1b7a6a 100%)' }}
      >
        <div className="brand-panel-grid" aria-hidden />
        <div className="brand-panel-inner">
          <div className="brand-panel-mark">
            <div className="brand-panel-mark-disc">CZ</div>
            <div className="brand-panel-mark-label">Competzy</div>
          </div>

          <div className="brand-panel-headline">
            <div className="brand-panel-headline-1">Forgot</div>
            <div className="brand-panel-headline-2">password?</div>
          </div>

          <div className="brand-panel-tagline">
            <div className="brand-panel-fullname">We&rsquo;ll get you back in.</div>
            <div className="brand-panel-quote">
              &ldquo;Enter the email you signed up with and we&rsquo;ll send a link to set a new password.&rdquo;
            </div>
          </div>

          <div className="brand-panel-footer">&copy; 2026 Competzy</div>
        </div>
      </div>

      <div className="form-panel hub-form-panel">
        <button
          onClick={toggle}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="hub-theme-toggle"
        >
          {isDark ? '☀' : '☾'}
        </button>

        <div className="form-panel-inner">
          {sent ? (
            <>
              <span className="form-eyebrow">Competzy · Password Reset</span>
              <h1>Check your inbox.</h1>
              <p className="form-subtitle">
                If <strong style={{ color: '#0d0d1a' }}>{email}</strong> matches a
                Competzy account, we&rsquo;ve sent a reset link there. The link is
                valid for <strong>15 minutes</strong>.
              </p>
              <p className="form-subtitle" style={{ marginTop: 8 }}>
                Didn&rsquo;t get it? Check your spam folder, or{' '}
                <button
                  type="button"
                  className="link"
                  onClick={() => { setSent(false); setError(''); }}
                >
                  try a different email
                </button>.
              </p>

              <Link href="/" className="btn-portal" style={{ marginTop: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
                Back to sign in
                <ArrowRightIcon />
              </Link>

              <div className="hub-rights" style={{ marginTop: 22 }}>
                Competzy &copy; 2026 &middot; All rights reserved
              </div>
              <div className="hub-legal">
                <Link href="/privacy">Privacy</Link>
                <span className="hub-legal-dot">&middot;</span>
                <Link href="/terms">Terms</Link>
                <span className="hub-legal-dot">&middot;</span>
                <a href="mailto:hello@competzy.com">Contact</a>
              </div>
            </>
          ) : (
            <>
              <span className="form-eyebrow">Competzy · Password Reset</span>
              <h1>Reset your password.</h1>
              <p className="form-subtitle">
                Enter your account email and we&rsquo;ll send a link to set a new password.
              </p>

              {error && <div className="portal-error">{error}</div>}

              <form onSubmit={submit} noValidate>
                <div className="form-row">
                  <label className="label-light" htmlFor="reset-email">Email</label>
                  <div className="icon-input-wrap">
                    <MailIcon />
                    <input
                      id="reset-email"
                      className="input-light"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                      aria-invalid={email.length > 0 && !emailValid}
                    />
                  </div>
                  {email.length > 0 && !emailValid && (
                    <div className="portal-hint" role="alert">
                      Please enter a valid email address.
                    </div>
                  )}
                </div>

                <button
                  className="btn-portal"
                  type="submit"
                  disabled={!emailValid || submitting}
                >
                  {submitting ? 'Sending link…' : 'Send reset link'}
                  {!submitting && <ArrowRightIcon />}
                </button>
              </form>

              <div className="portal-switch">
                Remembered it?&nbsp;
                <Link href="/">Back to sign in</Link>
              </div>

              <div className="hub-rights">
                Competzy &copy; 2026 &middot; All rights reserved
              </div>
              <div className="hub-legal">
                <Link href="/privacy">Privacy</Link>
                <span className="hub-legal-dot">&middot;</span>
                <Link href="/terms">Terms</Link>
                <span className="hub-legal-dot">&middot;</span>
                <a href="mailto:hello@competzy.com">Contact</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
