'use client';

// Reset-password landing. Reads ?token=… from the URL, submits to
// POST /api/auth/reset-password. Token is single-use server-side; client
// just validates length + match and trusts the backend's verdict.

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { adminHttp } from '@/lib/api/client';
import { useTheme } from '@/lib/theme/context';
import {
  LockIcon, EyeIcon, EyeOffIcon, ArrowRightIcon,
} from '@/components/competition-portal/icons';

function ResetPasswordInner() {
  const router  = useRouter();
  const params  = useSearchParams();
  const token   = params.get('token') ?? '';
  const { theme, toggle } = useTheme();
  const isDark  = theme === 'dark';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [submitting, setSubmit]   = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');

  const tooShort  = password.length > 0 && password.length < 8;
  const mismatch  = confirm.length > 0 && confirm !== password;
  const canSubmit = !!token && password.length >= 8 && confirm === password && !submitting;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(''); setSubmit(true);
    try {
      await adminHttp.post('/auth/reset-password', { token, password });
      setDone(true);
      // Send the user to sign-in after a short pause so they can read the success copy.
      setTimeout(() => router.replace('/'), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password. Please try again.');
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
            <div className="brand-panel-headline-1">Set a new</div>
            <div className="brand-panel-headline-2">password.</div>
          </div>

          <div className="brand-panel-tagline">
            <div className="brand-panel-fullname">Almost there.</div>
            <div className="brand-panel-quote">
              &ldquo;Choose a password at least 8 characters long. We&rsquo;ll sign you in next.&rdquo;
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
          {!token ? (
            <>
              <span className="form-eyebrow">Competzy · Password Reset</span>
              <h1>Link is missing.</h1>
              <p className="form-subtitle">
                This page needs a reset token in the URL. The link in your email should bring you here automatically.
              </p>
              <Link href="/forgot-password" className="btn-portal" style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
                Request a new link
                <ArrowRightIcon />
              </Link>
            </>
          ) : done ? (
            <>
              <span className="form-eyebrow">Competzy · Password Reset</span>
              <h1>Password updated.</h1>
              <p className="form-subtitle">
                You can sign in with the new password now. Redirecting to sign-in…
              </p>
              <Link href="/" className="btn-portal" style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
                Sign in now
                <ArrowRightIcon />
              </Link>
            </>
          ) : (
            <>
              <span className="form-eyebrow">Competzy · Password Reset</span>
              <h1>Choose a new password.</h1>
              <p className="form-subtitle">Minimum 8 characters. Use something you don&rsquo;t use elsewhere.</p>

              {error && <div className="portal-error">{error}</div>}

              <form onSubmit={submit} noValidate>
                <div className="form-row">
                  <label className="label-light" htmlFor="reset-pwd">New password</label>
                  <div className="icon-input-wrap">
                    <LockIcon />
                    <input
                      id="reset-pwd"
                      className="input-light has-suffix"
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoFocus
                      aria-invalid={tooShort}
                    />
                    <button
                      type="button"
                      className="input-suffix"
                      onClick={() => setShowPwd(v => !v)}
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                    >
                      {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {tooShort && (
                    <div className="portal-hint" role="alert">
                      Password must be at least 8 characters.
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <label className="label-light" htmlFor="reset-confirm">Confirm password</label>
                  <div className="icon-input-wrap">
                    <LockIcon />
                    <input
                      id="reset-confirm"
                      className="input-light"
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      aria-invalid={mismatch}
                    />
                  </div>
                  {mismatch && (
                    <div className="portal-hint" role="alert">
                      Passwords don&rsquo;t match.
                    </div>
                  )}
                </div>

                <button className="btn-portal" type="submit" disabled={!canSubmit}>
                  {submitting ? 'Updating…' : 'Update password'}
                  {!submitting && <ArrowRightIcon />}
                </button>
              </form>

              <div className="portal-switch">
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

export default function ResetPasswordPage() {
  // useSearchParams must be inside a Suspense boundary in Next.js 14+
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
