'use client';

// Unified login for the Competzy operator portal.
// One form, one POST /api/auth/login, then route by role:
//   admin              → /dashboard
//   organizer          → /organizer-dashboard
//   school_admin/teacher → /school-dashboard
//   student/parent     → /emc/dashboard
// If a session cookie already exists, skip the form and route on mount.

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminHttp } from '@/lib/api/client';
import { useTheme } from '@/lib/theme/context';
import type { AuthUser } from '@/types';
import {
  MailIcon, LockIcon, EyeIcon, EyeOffIcon, ArrowRightIcon,
} from '@/components/competition-portal/icons';

function destinationFor(role: string): string {
  switch (role) {
    case 'admin':        return '/dashboard';
    case 'organizer':    return '/organizer-dashboard';
    case 'school_admin':
    case 'teacher':      return '/school-dashboard';
    case 'student':
    case 'parent':       return '/emc/dashboard';
    default:             return '/dashboard';
  }
}

export default function UnifiedLogin() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  const [hydrating, setHydrating]     = useState(true);
  const [existingUser, setExisting]   = useState<AuthUser | null>(null);
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [remember, setRemember]       = useState(true);
  const [error, setError]             = useState('');
  const [submitting, setSubmit]       = useState(false);
  const [switching, setSwitching]     = useState(false);

  // Detect an existing session but DON'T auto-redirect — let the user choose
  // between continuing to their dashboard or switching accounts.
  useEffect(() => {
    let cancelled = false;
    adminHttp
      .get<AuthUser>('/auth/me')
      .then(me => { if (!cancelled) setExisting(me); })
      .catch(() => { /* not signed in — fall through to form */ })
      .finally(() => { if (!cancelled) setHydrating(false); });
    return () => { cancelled = true; };
  }, []);

  const continueToDashboard = () => {
    if (existingUser) router.replace(destinationFor(existingUser.role));
  };

  const switchAccount = async () => {
    setSwitching(true);
    try {
      await adminHttp.post('/auth/logout', {});
    } catch { /* ignore — we just want the cookie cleared */ }
    setExisting(null);
    setSwitching(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setSubmit(true);
    try {
      const res = await adminHttp.post<{ token: string; user: AuthUser }>(
        '/auth/login', { email, password },
      );
      router.replace(destinationFor(res.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmit(false);
    }
  };

  return (
    <div className="auth-split hub-split" style={{ ['--portal-accent' as string]: '#0d7377' }}>
      {/* ───── Left: branded gradient ───── */}
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
            <div className="brand-panel-headline-1">Run the</div>
            <div className="brand-panel-headline-2">Stage.</div>
          </div>

          <div className="brand-panel-tagline">
            <div className="brand-panel-fullname">Competzy Operator Portal</div>
            <div className="brand-panel-quote">
              &ldquo;Indonesia&rsquo;s unified stage for student competitions — admins,
              organizers, schools, and students, in one place.&rdquo;
            </div>
          </div>

          <div className="brand-panel-footer">&copy; 2026 Competzy</div>
        </div>
      </div>

      {/* ───── Right: unified login form ───── */}
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
          {hydrating ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#6b6b80' }}>
              <span className="spin" /> Checking your session…
            </div>
          ) : existingUser ? (
            <>
              <span className="form-eyebrow">Competzy · Web Portal</span>
              <h1>Already signed in.</h1>
              <p className="form-subtitle">
                You&rsquo;re signed in as{' '}
                <strong style={{ color: '#0d0d1a' }}>
                  {existingUser.fullName || existingUser.full_name || existingUser.email}
                </strong>{' '}
                ({existingUser.role}).
              </p>

              <button
                className="btn-portal"
                onClick={continueToDashboard}
                style={{ marginBottom: 12 }}
              >
                Continue to your dashboard
                <ArrowRightIcon />
              </button>

              <button
                onClick={switchAccount}
                disabled={switching}
                style={{
                  width: '100%',
                  background: '#fff',
                  border: '1px solid #e4e4ee',
                  borderRadius: 12,
                  padding: 13,
                  color: '#4c4c6a',
                  font: '500 14px/1 var(--ff-body)',
                  cursor: 'pointer',
                }}
              >
                {switching ? 'Signing out…' : 'Sign out & switch account'}
              </button>

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
              <span className="form-eyebrow">Competzy · Web Portal</span>
              <h1>Welcome back.</h1>
              <p className="form-subtitle">Sign in to continue to your workspace.</p>

              {error && <div className="portal-error">{error}</div>}

              <form onSubmit={submit}>
                <div className="form-row">
                  <label className="label-light" htmlFor="login-email">Email</label>
                  <div className="icon-input-wrap">
                    <MailIcon />
                    <input
                      id="login-email"
                      className="input-light"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="form-row">
                  <label className="label-light" htmlFor="login-pwd">Password</label>
                  <div className="icon-input-wrap">
                    <LockIcon />
                    <input
                      id="login-pwd"
                      className="input-light has-suffix"
                      type={showPwd ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
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
                </div>

                <div className="portal-meta-row">
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      style={{ accentColor: '#0d7377' }}
                    />
                    Remember me
                  </label>
                  <button type="button" className="link" onClick={() => alert('Password reset is coming soon. For now, ask an admin to reset it.')}>
                    Forgot password?
                  </button>
                </div>

                <button className="btn-portal" type="submit" disabled={submitting}>
                  {submitting ? 'Signing in…' : 'Sign In'}
                  {!submitting && <ArrowRightIcon />}
                </button>
              </form>

              <div className="portal-switch">
                New to Competzy?&nbsp;
                <Link href="/emc/register">Create a student account</Link>
              </div>

              <div className="hub-secondary-links">
                <Link href="/school-signup">Sign up as a school</Link>
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
