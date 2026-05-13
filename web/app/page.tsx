'use client';

// Unified login for the Competzy portal.
// Two sign-in modes:
//   - Email + password  (POST /api/auth/login)
//   - Phone + OTP       (POST /api/auth/phone/send-otp → /verify-otp)
// Both issue the httpOnly competzy_token cookie server-side, after which we
// route by role:
//   admin                  → /dashboard
//   organizer              → /organizer-dashboard
//   school_admin / teacher → /school-dashboard
//   student / parent       → /competitions/[DEFAULT_COMPETITION_SLUG]/dashboard
// (Wave 2 will replace the slug default with a `/competitions` catalog page.)
// If a session cookie is already present, we surface a "continue or switch"
// chooser instead of auto-redirecting.

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminHttp } from '@/lib/api/client';
import { useTheme } from '@/lib/theme/context';
import type { AuthUser } from '@/types';
import {
  MailIcon, LockIcon, EyeIcon, EyeOffIcon, ArrowRightIcon, PhoneIcon,
} from '@/components/competition-portal/icons';
import {
  DEFAULT_COMPETITION_SLUG,
  competitionPaths,
} from '@/lib/competitions/registry';

type Mode = 'email' | 'phone';

const defaultCompetition = competitionPaths(DEFAULT_COMPETITION_SLUG);

function destinationFor(role: string): string {
  switch (role) {
    case 'admin':        return '/dashboard';
    case 'organizer':    return '/organizer-dashboard';
    case 'school_admin':
    case 'teacher':      return '/school-dashboard';
    case 'student':
    case 'parent':       return defaultCompetition.dashboard;
    default:             return '/dashboard';
  }
}

export default function UnifiedLogin() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  const [hydrating, setHydrating]     = useState(true);
  const [existingUser, setExisting]   = useState<AuthUser | null>(null);
  const [mode, setMode]               = useState<Mode>('email');

  // Email/password state
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [remember, setRemember]       = useState(true);

  // Phone/OTP state
  const [phone, setPhone]             = useState('');
  const [otpCode, setOtpCode]         = useState('');
  const [otpSent, setOtpSent]         = useState(false);
  const [otpInfo, setOtpInfo]         = useState('');

  const [error, setError]             = useState('');
  const [submitting, setSubmit]       = useState(false);
  const [switching, setSwitching]     = useState(false);

  // Light client-side validation. We don't gate submit on this — backend
  // still validates — but we surface inline hints when fields look off.
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneValid = /^\+?\d{8,15}$/.test(phone.replace(/[\s-]/g, ''));

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

  const switchMode = (m: Mode) => {
    if (m === mode || submitting) return;
    setMode(m);
    setError('');
    setOtpSent(false);
    setOtpCode('');
    setOtpInfo('');
  };

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailValid || password.length < 6 || submitting) return;
    setError(''); setSubmit(true);
    try {
      const res = await adminHttp.post<{ token: string; user: AuthUser }>(
        '/auth/login', { email, password },
      );
      router.replace(destinationFor(res.user.role));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      // Backend returns "Invalid email or password" for a missing user OR a
      // bad password — surface a more action-oriented version of that.
      if (/invalid email or password/i.test(msg)) {
        setError("That email and password don't match. Try again, or use Forgot password.");
      } else {
        setError(msg || 'Could not sign in. Please try again.');
      }
    } finally {
      setSubmit(false);
    }
  };

  const sendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!phoneValid || submitting) return;
    setError(''); setOtpInfo(''); setSubmit(true);
    try {
      await adminHttp.post('/auth/phone/send-otp', { phone });
      setOtpSent(true);
      setOtpInfo('Code sent. Check your phone — it can take a moment.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code. Please try again.');
    } finally {
      setSubmit(false);
    }
  };

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 4 || submitting) return;
    setError(''); setSubmit(true);
    try {
      const res = await adminHttp.post<{ token?: string; user?: AuthUser; historicalMatch?: boolean }>(
        '/auth/phone/verify-otp', { phone, code: otpCode },
      );
      if (res.user) {
        router.replace(destinationFor(res.user.role));
      } else if (res.historicalMatch) {
        // The phone matched a legacy record but no account exists yet — punt
        // to the register page where the matched name/email can prefill.
        setError('We found your historical record. Open the Competzy app and tap Sign up to claim it.');
      } else {
        setError("Couldn't sign you in. Try the email option, or sign up.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/no_account/i.test(msg)) {
        setError("That phone isn't linked to an account. Sign up first, then phone sign-in will work.");
      } else if (/invalid|expired/i.test(msg)) {
        setError('That code is incorrect or has expired. Request a new one.');
      } else {
        setError(msg || 'Could not verify the code. Please try again.');
      }
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
            <div className="brand-panel-fullname">Competzy Portal</div>
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
            <div className="hub-skeleton" aria-busy="true" aria-live="polite">
              <div className="hub-skeleton-eyebrow" />
              <div className="hub-skeleton-title" />
              <div className="hub-skeleton-line" />
              <div className="hub-skeleton-input" />
              <div className="hub-skeleton-input" />
              <div className="hub-skeleton-button" />
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

              <div className="hub-mode-toggle" role="tablist" aria-label="Sign-in method">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'email'}
                  className={`hub-mode-toggle-btn ${mode === 'email' ? 'is-active' : ''}`}
                  onClick={() => switchMode('email')}
                >
                  Email
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'phone'}
                  className={`hub-mode-toggle-btn ${mode === 'phone' ? 'is-active' : ''}`}
                  onClick={() => switchMode('phone')}
                >
                  Phone
                </button>
              </div>

              {error && <div className="portal-error">{error}</div>}
              {otpInfo && !error && <div className="portal-toast">{otpInfo}</div>}

              {mode === 'email' ? (
                <form onSubmit={submitEmail} noValidate>
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
                        aria-invalid={email.length > 0 && !emailValid}
                      />
                    </div>
                    {email.length > 0 && !emailValid && (
                      <div className="portal-hint" role="alert">
                        Please enter a valid email address.
                      </div>
                    )}
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
                    <Link href="/forgot-password" className="link">Forgot password?</Link>
                  </div>

                  <button
                    className="btn-portal"
                    type="submit"
                    disabled={!emailValid || password.length < 6 || submitting}
                  >
                    {submitting ? 'Signing in…' : 'Sign In'}
                    {!submitting && <ArrowRightIcon />}
                  </button>
                </form>
              ) : (
                <>
                  {!otpSent ? (
                    <form onSubmit={sendOtp} noValidate>
                      <div className="form-row">
                        <label className="label-light" htmlFor="login-phone">Phone number</label>
                        <div className="icon-input-wrap">
                          <PhoneIcon />
                          <input
                            id="login-phone"
                            className="input-light"
                            type="tel"
                            placeholder="+62…"
                            autoComplete="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            required
                            autoFocus
                            aria-invalid={phone.length > 0 && !phoneValid}
                          />
                        </div>
                        {phone.length > 0 && !phoneValid && (
                          <div className="portal-hint" role="alert">
                            Use the international format, e.g. <code>+628123456789</code>.
                          </div>
                        )}
                      </div>

                      <button
                        className="btn-portal"
                        type="submit"
                        disabled={!phoneValid || submitting}
                      >
                        {submitting ? 'Sending code…' : 'Send code'}
                        {!submitting && <ArrowRightIcon />}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={verifyOtp} noValidate>
                      <p className="form-subtitle" style={{ marginTop: -4 }}>
                        Code sent to <strong style={{ color: '#0d0d1a' }}>{phone}</strong>.
                      </p>
                      <div className="form-row">
                        <label className="label-light" htmlFor="login-otp">6-digit code</label>
                        <div className="icon-input-wrap">
                          <LockIcon />
                          <input
                            id="login-otp"
                            className="input-light"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="••••••"
                            value={otpCode}
                            onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            required
                            autoFocus
                          />
                        </div>
                      </div>

                      <button
                        className="btn-portal"
                        type="submit"
                        disabled={otpCode.length < 4 || submitting}
                      >
                        {submitting ? 'Verifying…' : 'Verify & Sign In'}
                        {!submitting && <ArrowRightIcon />}
                      </button>

                      <div className="portal-meta-row" style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className="link"
                          onClick={() => { setOtpSent(false); setOtpCode(''); setOtpInfo(''); setError(''); }}
                        >
                          Use a different number
                        </button>
                        <button
                          type="button"
                          className="link"
                          onClick={() => sendOtp(new Event('submit') as unknown as FormEvent)}
                        >
                          Resend code
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}

              <div className="portal-switch">
                New to Competzy?&nbsp;
                <Link href={defaultCompetition.register}>Create a student account</Link>
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
