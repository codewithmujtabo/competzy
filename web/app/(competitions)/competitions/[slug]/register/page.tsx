'use client';

// Per-competition registration entry point. The URL keeps the slug
// (`/competitions/[slug]/register`) so the page can auto-enroll the new
// student into the right competition and route them back to its dashboard
// after signup. The page itself renders generic Competzy branding — no
// per-competition wordmark, logo, or tagline. Competition context is
// behavioural only, never visual.

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { CompetzyBrandPanel } from '@/components/auth/competzy-brand-panel';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CountrySelect } from '@/components/ui/country-select';

type SignupResponse = { token: string; user: { id: string; role: string } };

export default function CompetitionRegisterPage() {
  const t = useT();
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
  const [country, setCountry] = useState<string | null>(null);
  // Province + city moved into the profile editor — registration only asks for
  // country (it gates international catalog visibility + voucher scoping).
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
        country: country ?? undefined,
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
            setWarning(t('creg.warnEnroll', { msg: msg || t('creg.unknownError') }));
            setTimeout(() => window.location.assign(paths.dashboard), 1200);
            return;
          }
        }
      } else {
        setWarning(t('creg.warnNotConfigured'));
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
        setError(t('creg.errPwdShort'));
      } else {
        setError(msg || t('creg.errDefault'));
      }
    } finally {
      setSubmit(false);
    }
  };

  const canSubmit =
    !submitting && consent && !!fullName.trim() && emailValid && !passwordTooShort && password.length >= 8 && phoneValid;

  if (!config) return null;

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Form panel — LEFT */}
      <div className="relative flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            {t('creg.eyebrow')}
          </p>
          <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">{t('creg.title')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('creg.subtitle')}</p>

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {emailTaken && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {t('creg.emailTakenPre')}
              <Link href="/" className="font-semibold underline">
                {t('creg.signInInstead')}
              </Link>
              {t('creg.emailTakenPost')}
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
                {t('creg.fullName')}
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
                {t('creg.email')}
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
                <p className="mt-1 text-xs text-destructive">{t('creg.emailInvalid')}</p>
              )}
            </div>

            <div>
              <Label htmlFor="reg-phone" className="mb-1.5 text-xs text-muted-foreground">
                {t('creg.phone')}
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reg-phone"
                  type="tel"
                  inputMode="tel"
                  className="pl-9"
                  placeholder={t('creg.phonePlaceholder')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  aria-invalid={!phoneValid}
                />
              </div>
              {!phoneValid && (
                <p className="mt-1 text-xs text-destructive">
                  {t('creg.phoneInvalidPre')}
                  <code className="font-mono">+628123456789</code>.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="reg-pwd" className="mb-1.5 text-xs text-muted-foreground">
                {t('creg.password')}
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
                  aria-label={showPwd ? t('creg.hidePassword') : t('creg.showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {passwordTooShort && (
                <p className="mt-1 text-xs text-destructive">{t('creg.passwordTooShort')}</p>
              )}
            </div>

            <div>
              <Label htmlFor="reg-country" className="mb-1.5 text-xs text-muted-foreground">
                {t('creg.country')}
              </Label>
              <CountrySelect id="reg-country" value={country} onChange={setCountry} />
              <p className="mt-1 text-xs text-muted-foreground">{t('creg.countryHint')}</p>
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
                {t('creg.consentPre')}
                <Link href="/terms" className="text-primary underline">
                  {t('creg.terms')}
                </Link>
                {t('creg.consentMid')}
                <Link href="/privacy" className="text-primary underline">
                  {t('creg.privacy')}
                </Link>
                {t('creg.consentPost')}
              </span>
            </label>

            <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
              {submitting ? t('creg.creating') : compLoading ? t('creg.loading') : t('creg.createAccount')}
              {!submitting && !compLoading && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {t('creg.haveAccount')}
            <Link href={paths.login} className="font-medium text-primary hover:underline">
              {t('creg.signIn')}
            </Link>
          </p>
        </div>
      </div>

      {/* Brand panel — RIGHT */}
      <CompetzyBrandPanel />
    </div>
  );
}
