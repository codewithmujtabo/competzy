'use client';

// Unified login for the Competzy portal.
// Two sign-in modes:
//   - Email + password  (POST /api/auth/login)
//   - Phone + OTP       (POST /api/auth/phone/send-otp → /verify-otp)
// Both issue the httpOnly competzy_token cookie server-side, after which we
// route by role.
//
// Why we hard-nav (window.location.assign) instead of router.replace:
// each per-role auth context (AuthProvider, OrganizerAuthProvider,
// SchoolAuthProvider, CompetitionAuthProvider) hydrates from /auth/me exactly
// once on mount. A client-side router.replace doesn't unmount the root layout,
// so the AuthProvider keeps user=null from its initial hydration (which ran
// BEFORE the login cookie existed) and the destination layout bounces back
// to /. A hard nav remounts the whole tree, the AuthProvider re-hydrates with
// the fresh cookie, and the destination renders normally.

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, Lock, Mail, Moon, Phone, Sun } from 'lucide-react';
import { adminHttp } from '@/lib/api/client';
import { useTheme } from '@/lib/theme/context';
import type { AuthUser } from '@/types';
import { DEFAULT_COMPETITION_SLUG, competitionPaths } from '@/lib/competitions/registry';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type Mode = 'email' | 'phone';

const defaultCompetition = competitionPaths(DEFAULT_COMPETITION_SLUG);

function destinationFor(role: string): string {
  switch (role) {
    case 'admin':
      return '/dashboard';
    case 'organizer':
      return '/organizer-dashboard';
    case 'school_admin':
    case 'teacher':
      return '/school-dashboard';
    case 'student':
    case 'parent':
      return defaultCompetition.dashboard;
    default:
      return '/dashboard';
  }
}

function goTo(role: string) {
  // Hard nav — see the comment block at the top of this file.
  window.location.assign(destinationFor(role));
}

export default function UnifiedLogin() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  const [hydrating, setHydrating] = useState(true);
  const [mode, setMode] = useState<Mode>('email');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);

  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInfo, setOtpInfo] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmit] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneValid = /^\+?\d{8,15}$/.test(phone.replace(/[\s-]/g, ''));

  useEffect(() => {
    let cancelled = false;
    adminHttp
      .get<AuthUser>('/auth/me')
      .then((me) => {
        if (!cancelled) goTo(me.role);
      })
      .catch(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setError('');
    setSubmit(true);
    try {
      const res = await adminHttp.post<{ token: string; user: AuthUser }>('/auth/login', {
        email,
        password,
      });
      goTo(res.user.role);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/invalid email or password/i.test(msg)) {
        setError("That email and password don't match. Try again, or use Forgot password.");
      } else {
        setError(msg || 'Could not sign in. Please try again.');
      }
      setSubmit(false);
    }
  };

  const sendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!phoneValid || submitting) return;
    setError('');
    setOtpInfo('');
    setSubmit(true);
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

  const resendOtp = async () => {
    if (submitting) return;
    setError('');
    setOtpInfo('');
    setSubmit(true);
    try {
      await adminHttp.post('/auth/phone/send-otp', { phone });
      setOtpInfo('Code resent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code. Please try again.');
    } finally {
      setSubmit(false);
    }
  };

  const verifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 4 || submitting) return;
    setError('');
    setSubmit(true);
    try {
      const res = await adminHttp.post<{ token?: string; user?: AuthUser; historicalMatch?: boolean }>(
        '/auth/phone/verify-otp',
        { phone, code: otpCode },
      );
      if (res.user) {
        goTo(res.user.role);
        return;
      } else if (res.historicalMatch) {
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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: 'linear-gradient(135deg,#0d7377 0%,#14a085 60%,#1b7a6a 100%)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:36px_36px]"
        />
        <div className="relative flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-xl border border-white/30 bg-white/15 font-mono text-sm font-semibold backdrop-blur">
            CZ
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-80">Competzy</span>
        </div>
        <h2 className="relative font-serif text-6xl leading-[0.96]">
          Run the
          <br />
          <span className="text-amber-300">Stage.</span>
        </h2>
        <div className="relative max-w-sm">
          <p className="font-medium opacity-95">Competzy Portal</p>
          <p className="mt-1 text-sm italic opacity-75">
            “Indonesia’s unified stage for student competitions — admins, organizers, schools, and
            students, in one place.”
          </p>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] opacity-60">
            © 2026 Competzy
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-background px-6 py-12">
        <button
          onClick={toggle}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        <div className="w-full max-w-md">
          {hydrating ? (
            <div className="space-y-3" aria-busy="true" aria-live="polite">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="mt-3 h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : (
            <>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                Competzy · Web Portal
              </p>
              <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">Welcome back.</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in to continue to your workspace.
              </p>

              <Tabs
                value={mode}
                onValueChange={(v) => switchMode(v as Mode)}
                className="mt-5"
              >
                <TabsList className="w-full">
                  <TabsTrigger value="email" className="flex-1">
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="flex-1">
                    Phone
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {error && (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              {otpInfo && !error && (
                <div className="mt-4 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  {otpInfo}
                </div>
              )}

              {mode === 'email' ? (
                <form onSubmit={submitEmail} noValidate className="mt-5 space-y-4">
                  <div>
                    <Label htmlFor="login-email" className="mb-1.5 text-xs text-muted-foreground">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-email"
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

                  <div>
                    <Label htmlFor="login-pwd" className="mb-1.5 text-xs text-muted-foreground">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-pwd"
                        type={showPwd ? 'text' : 'password'}
                        className="px-9"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
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
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="size-4 accent-primary"
                      />
                      Remember me
                    </label>
                    <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={!emailValid || password.length < 6 || submitting}
                  >
                    {submitting ? 'Signing in…' : 'Sign in'}
                    {!submitting && <ArrowRight className="size-4" />}
                  </Button>
                </form>
              ) : !otpSent ? (
                <form onSubmit={sendOtp} noValidate className="mt-5 space-y-4">
                  <div>
                    <Label htmlFor="login-phone" className="mb-1.5 text-xs text-muted-foreground">
                      Phone number
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-phone"
                        type="tel"
                        className="pl-9"
                        placeholder="+62…"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        autoFocus
                        aria-invalid={phone.length > 0 && !phoneValid}
                      />
                    </div>
                    {phone.length > 0 && !phoneValid && (
                      <p className="mt-1 text-xs text-destructive">
                        Use the international format, e.g. <code className="font-mono">+628123456789</code>.
                      </p>
                    )}
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={!phoneValid || submitting}>
                    {submitting ? 'Sending code…' : 'Send code'}
                    {!submitting && <ArrowRight className="size-4" />}
                  </Button>
                </form>
              ) : (
                <form onSubmit={verifyOtp} noValidate className="mt-5 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Code sent to <strong className="text-foreground">{phone}</strong>.
                  </p>
                  <div>
                    <Label htmlFor="login-otp" className="mb-1.5 text-xs text-muted-foreground">
                      6-digit code
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-otp"
                        type="text"
                        inputMode="numeric"
                        className="pl-9 tracking-[0.3em]"
                        autoComplete="one-time-code"
                        placeholder="••••••"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={otpCode.length < 4 || submitting}>
                    {submitting ? 'Verifying…' : 'Verify & sign in'}
                    {!submitting && <ArrowRight className="size-4" />}
                  </Button>
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setOtpInfo('');
                        setError('');
                      }}
                    >
                      Use a different number
                    </button>
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline disabled:opacity-50"
                      onClick={resendOtp}
                      disabled={submitting}
                    >
                      Resend code
                    </button>
                  </div>
                </form>
              )}

              <p className="mt-6 text-center text-sm text-muted-foreground">
                New to Competzy?{' '}
                <Link href={defaultCompetition.register} className="font-medium text-primary hover:underline">
                  Create a student account
                </Link>
              </p>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                <Link href="/school-signup" className="font-medium text-primary hover:underline">
                  Sign up as a school
                </Link>
              </p>

              <div className="mt-8 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <Link href="/privacy" className="hover:text-foreground">
                  Privacy
                </Link>
                <span>·</span>
                <Link href="/terms" className="hover:text-foreground">
                  Terms
                </Link>
                <span>·</span>
                <a href="mailto:hello@competzy.com" className="hover:text-foreground">
                  Contact
                </a>
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Competzy © 2026 · All rights reserved
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
