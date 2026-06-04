'use client';

// Unified login for the Competzy portal.
// Two sign-in modes:
//   - Email + password  (POST /api/auth/login)
//   - Phone + OTP       (POST /api/auth/phone/send-otp → /verify-otp)
// Both issue the httpOnly competzy_token cookie server-side, after which we
// route by role.
//
// Layout: sign-in form on the LEFT, violet brand panel on the RIGHT.
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
import { useT } from '@/lib/i18n/context';
import { LocaleToggle } from '@/components/shell/locale-toggle';
import type { AuthUser } from '@/types';
import { destinationFor } from '@/lib/auth/role-destination';
import {
  DEFAULT_COMPETITION_SLUG,
  competitionPaths,
  competitionRegistry,
} from '@/lib/competitions/registry';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompetzyBrandPanel } from '@/components/auth/competzy-brand-panel';

type Mode = 'email' | 'phone';

const defaultCompetition = competitionPaths(DEFAULT_COMPETITION_SLUG);

// Returns the `?comp=<slug>` value from the current URL, normalised + only
// when it matches a known competition. Falls back to null. Slug is used
// purely to route the post-login redirect — branding here is always generic
// Competzy regardless of the slug.
function readSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('comp');
  if (!raw) return null;
  const slug = raw.trim().toLowerCase();
  return slug in competitionRegistry ? slug : null;
}

// When a competition slug is in play, student/parent post-login lands on
// that competition's dashboard instead of the catalog. Other roles ignore
// the slug — admins/organizers/schools always go to their own workspace.
function goTo(role: string, slug: string | null) {
  if (slug && (role === 'student' || role === 'parent')) {
    window.location.assign(competitionPaths(slug).dashboard);
    return;
  }
  // Hard nav — see the comment block at the top of this file.
  window.location.assign(destinationFor(role));
}

export default function UnifiedLogin() {
  const { theme, toggle } = useTheme();
  const t = useT();
  const isDark = theme === 'dark';

  const [hydrating, setHydrating] = useState(true);
  const [mode, setMode] = useState<Mode>('email');
  const [slug, setSlug] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInfo, setOtpInfo] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmit] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneValid = /^\+?\d{8,15}$/.test(phone.replace(/[\s-]/g, ''));

  // Sign-up + forgot-password preserve the `?comp=` slug (when present) so
  // post-auth still routes the student/parent back to the right competition,
  // even though the screens themselves render generic Competzy branding.
  const signUpHref = slug ? competitionPaths(slug).register : defaultCompetition.register;
  const forgotHref = slug ? competitionPaths(slug).forgotPassword : '/forgot-password';

  // Read `?comp=` once on mount, BEFORE the auth-hydrate check, so a
  // signed-in student that arrived from competzy.com/komodo lands on the
  // Komodo dashboard instead of the generic catalog.
  useEffect(() => {
    setSlug(readSlugFromUrl());
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminHttp
      .get<AuthUser>('/auth/me')
      .then((me) => {
        if (!cancelled) goTo(me.role, readSlugFromUrl());
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
    if (!emailValid || password.length < 8 || submitting) return;
    setError('');
    setSubmit(true);
    try {
      const res = await adminHttp.post<{ token: string; user: AuthUser }>('/auth/login', {
        email,
        password,
      });
      goTo(res.user.role, slug);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/invalid email or password/i.test(msg)) {
        setError(t('login.emailMismatch'));
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
      setOtpInfo(t('login.codeSent'));
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
        goTo(res.user.role, slug);
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
        setError(t('login.codeInvalid'));
      } else {
        setError(msg || 'Could not verify the code. Please try again.');
      }
    } finally {
      setSubmit(false);
    }
  };

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Language + theme toggles — pinned to the top-right of the whole screen */}
      <div className="absolute right-5 top-5 z-20 flex items-center gap-2">
        <LocaleToggle className="rounded-lg border bg-card px-2 py-1.5" />
        <button
          onClick={toggle}
          aria-label={isDark ? t('common.lightMode') : t('common.darkMode')}
          title={isDark ? t('common.lightMode') : t('common.darkMode')}
          className="flex size-9 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>

      {/* Form panel — LEFT */}
      <div className="relative flex items-center justify-center bg-background px-6 py-12">
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
              {/* Logo — clickable, doubles as a back link to competzy.com */}
              <a
                href="https://competzy.com"
                aria-label="Back to competzy.com"
                className="group mb-7 inline-flex items-center gap-3 rounded-lg transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 focus-visible:ring-offset-2"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-[#4a148c] font-mono text-sm font-semibold tracking-wide text-white shadow-sm">
                  CZ
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors group-hover:text-foreground">
                  competzy.com
                </span>
              </a>

              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                {t('login.eyebrow')}
              </p>
              <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">
                {t('login.welcomeBack')}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{t('login.subtitle')}</p>

              <Tabs
                value={mode}
                onValueChange={(v) => switchMode(v as Mode)}
                className="mt-5"
              >
                <TabsList className="w-full">
                  <TabsTrigger value="email" className="flex-1">
                    {t('login.tabEmail')}
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="flex-1">
                    {t('login.tabPhone')}
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
                      {t('login.emailLabel')}
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
                      {t('login.passwordLabel')}
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

                  <div className="flex items-center justify-end text-sm">
                    <Link href={forgotHref} className="font-medium text-primary hover:underline">
                      {t('login.forgotPassword')}
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={!emailValid || password.length < 8 || submitting}
                  >
                    {submitting ? t('login.signingIn') : t('login.signInButton')}
                    {!submitting && <ArrowRight className="size-4" />}
                  </Button>
                </form>
              ) : !otpSent ? (
                <form onSubmit={sendOtp} noValidate className="mt-5 space-y-4">
                  <div>
                    <Label htmlFor="login-phone" className="mb-1.5 text-xs text-muted-foreground">
                      {t('login.phoneLabel')}
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="login-phone"
                        type="tel"
                        inputMode="tel"
                        className="pl-9"
                        placeholder="08xxxxxxxx or +628xxxxxxxx"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        autoFocus
                        aria-invalid={phone.length > 0 && !phoneValid}
                      />
                    </div>
                    {phone.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Use <code className="font-mono">08xxx</code> or <code className="font-mono">+62xxx</code> format.
                      </p>
                    ) : !phoneValid ? (
                      <p className="mt-1 text-xs text-destructive">
                        Enter a valid phone number (e.g. <code className="font-mono">08123456789</code> or{' '}
                        <code className="font-mono">+628123456789</code>).
                      </p>
                    ) : null}
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={!phoneValid || submitting}>
                    {submitting ? t('login.sendingCode') : t('login.sendCode')}
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
                      {t('login.otpLabel')}
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
                    {submitting ? t('login.verifying') : t('login.verifyButton')}
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
                      {t('login.useDifferentNumber')}
                    </button>
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline disabled:opacity-50"
                      onClick={resendOtp}
                      disabled={submitting}
                    >
                      {t('login.resendCode')}
                    </button>
                  </div>
                </form>
              )}

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {t('login.newToCompetzy')}{' '}
                <Link href={signUpHref} className="font-medium text-primary hover:underline">
                  {t('common.signUp')}
                </Link>
              </p>

              <div className="mt-8 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <Link href="/privacy" className="hover:text-foreground">
                  {t('login.footerPrivacy')}
                </Link>
                <span>·</span>
                <Link href="/terms" className="hover:text-foreground">
                  {t('login.footerTerms')}
                </Link>
                <span>·</span>
                <a href="mailto:hello@competzy.com" className="hover:text-foreground">
                  {t('login.footerContact')}
                </a>
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Competzy © 2026 · All rights reserved
              </p>
            </>
          )}
        </div>
      </div>

      {/* Brand panel — RIGHT */}
      <CompetzyBrandPanel />
    </div>
  );
}
