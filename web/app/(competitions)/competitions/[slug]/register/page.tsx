'use client';

// Per-competition registration page. Reads the slug from the URL, resolves
// the portal config, renders the SplitScreenAuth shell with the matching
// brand, and auto-enrolls the new student into the competition on signup.

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, Lock, Mail, MapPin, Phone, User } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { SplitScreenAuth } from '@/components/competition-portal/SplitScreenAuth';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type SignupResponse = { token: string; user: { id: string; role: string } };

export default function CompetitionRegisterPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  const paths = competitionPaths(slug);
  const { user, loading: authLoading } = useCompetitionAuth();
  const { comp, loading: compLoading } = usePortalComp(slug);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [warning, setWarning] = useState('');
  const [submitting, setSubmit] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneValid = phone === '' || /^\+?\d{8,15}$/.test(phone.replace(/[\s-]/g, ''));
  const passwordTooShort = password.length > 0 && password.length < 8;

  useEffect(() => {
    if (!authLoading && user) {
      window.location.assign(user.role === 'admin' ? paths.admin : paths.dashboard);
    }
  }, [user, authLoading, paths.admin, paths.dashboard]);

  // Capture an affiliate ?ref= code. Read from window.location (not
  // useSearchParams) so the page needs no Suspense boundary.
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('ref');
    if (r && r.trim()) setRefCode(r.trim());
  }, []);

  // Log the referral click once per visit (best-effort).
  useEffect(() => {
    if (!refCode || !comp?.id) return;
    const key = `competzy.refclick.${comp.id}.${refCode}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    emcHttp.post('/referrals/click', { compId: comp.id, code: refCode }).catch(() => {});
  }, [refCode, comp?.id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailValid || password.length < 8 || !consent || !phoneValid) return;
    setError('');
    setEmailTaken(false);
    setWarning('');
    setSubmit(true);
    try {
      await emcHttp.post<SignupResponse>('/auth/signup', {
        email,
        password,
        fullName,
        phone: phone || undefined,
        city: city || undefined,
        province: province || undefined,
        role: 'student',
        roleData: {},
        consentAccepted: consent,
      });

      if (comp?.id) {
        // Attribute the new account to its referral, if it arrived via ?ref=.
        if (refCode) {
          emcHttp
            .post('/referrals/signup', { compId: comp.id, code: refCode })
            .catch(() => {});
        }
        try {
          await emcHttp.post('/registrations', {
            id: crypto.randomUUID(),
            compId: comp.id,
            referralCode: refCode ?? undefined,
          });
        } catch (regErr) {
          const msg = regErr instanceof Error ? regErr.message : '';
          if (!/already exists/i.test(msg)) {
            setWarning(
              `Account created, but we couldn’t auto-enroll you in ${config?.wordmark ?? 'this competition'}: ${msg || 'unknown error'}. You can register from the dashboard.`,
            );
            setTimeout(() => window.location.assign(paths.dashboard), 1200);
            return;
          }
        }
      } else {
        setWarning(
          `Account created, but ${config?.wordmark ?? 'this competition'} isn’t configured yet. Run the latest migration to enable enrollment.`,
        );
        setTimeout(() => window.location.assign(paths.dashboard), 1500);
        return;
      }
      window.location.assign(paths.dashboard);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/already registered/i.test(msg)) {
        setEmailTaken(true);
        setError('');
      } else if (/at least 6 characters|password must be at least/i.test(msg)) {
        setError('Password is too short. Use at least 8 characters.');
      } else {
        setError(msg || 'Could not create your account. Please try again.');
      }
    } finally {
      setSubmit(false);
    }
  };

  const canSubmit =
    !submitting && consent && !!fullName.trim() && emailValid && !passwordTooShort && password.length >= 8 && phoneValid;

  if (!config) return null;

  return (
    <SplitScreenAuth config={config}>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
        {config.shortName} · Create account
      </p>
      <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">Join the championship.</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Sign up once and we’ll enroll you in {config.wordmark} automatically.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {emailTaken && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          That email is already registered.{' '}
          <Link href="/" className="font-semibold underline">
            Sign in instead
          </Link>{' '}
          or use Forgot password.
        </div>
      )}
      {warning && (
        <div className="mt-4 rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          {warning}
        </div>
      )}

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <div>
          <Label htmlFor="reg-name" className="mb-1.5 text-xs text-muted-foreground">
            Full name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reg-name"
              className="pl-9"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="reg-email" className="mb-1.5 text-xs text-muted-foreground">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reg-email"
              type="email"
              className="pl-9"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailTaken(false);
              }}
              required
              autoComplete="email"
              aria-invalid={email.length > 0 && !emailValid}
            />
          </div>
          {email.length > 0 && !emailValid && (
            <p className="mt-1 text-xs text-destructive">Please enter a valid email address.</p>
          )}
        </div>

        <div>
          <Label htmlFor="reg-phone" className="mb-1.5 text-xs text-muted-foreground">
            Phone (E.164, optional)
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reg-phone"
              type="tel"
              className="pl-9"
              placeholder="+62…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              aria-invalid={!phoneValid}
            />
          </div>
          {!phoneValid && (
            <p className="mt-1 text-xs text-destructive">
              Use the international format, e.g. <code className="font-mono">+628123456789</code>.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="reg-pwd" className="mb-1.5 text-xs text-muted-foreground">
            Password (min 8 characters)
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reg-pwd"
              type={showPwd ? 'text' : 'password'}
              className="px-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              aria-invalid={passwordTooShort}
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
          {passwordTooShort && (
            <p className="mt-1 text-xs text-destructive">Password must be at least 8 characters.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="reg-city" className="mb-1.5 text-xs text-muted-foreground">
              City (optional)
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="reg-city"
                className="pl-9"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                autoComplete="address-level2"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="reg-prov" className="mb-1.5 text-xs text-muted-foreground">
              Province (optional)
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="reg-prov"
                className="pl-9"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                autoComplete="address-level1"
              />
            </div>
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            I agree to the Competzy{' '}
            <Link href="/terms" className="text-primary underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary underline">
              Privacy Policy
            </Link>
            , and consent to processing of my data for {config.wordmark} registration.
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
          {submitting ? 'Creating account…' : compLoading ? 'Loading…' : 'Create account'}
          {!submitting && !compLoading && <ArrowRight className="size-4" />}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href={paths.login} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </SplitScreenAuth>
  );
}
