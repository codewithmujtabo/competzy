'use client';

// Per-competition registration entry point. The URL keeps the slug
// (`/competitions/[slug]/register`) so the page can auto-enroll the new
// student into the right competition and route them back to its dashboard
// after signup. The page itself renders generic Competzy branding — no
// per-competition wordmark, logo, or tagline. Competition context is
// behavioural only, never visual.
//
// Signup is a two-step flow:
//   1. form   — collect details, then POST /auth/signup/send-code (emails a code)
//   2. verify — enter the 6-digit code, then POST /auth/signup (creates account)
// The account is never created until the email is proven, so there are no
// unverified ghost accounts.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, Building2, Eye, EyeOff, GraduationCap, Hash, Lock, Mail, MailCheck, Phone, RotateCw, School, User } from 'lucide-react';
import { emcHttp, HttpError } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { CompetzyBrandPanel } from '@/components/auth/competzy-brand-panel';
import { PublicToggles } from '@/components/shell/public-toggles';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CountrySelect } from '@/components/ui/country-select';

type SignupResponse = { token: string; user: { id: string; role: string } };
type SendCodeResponse = { message: string; devBypass?: boolean; devCode?: string; expiresInMinutes?: number };

const RESEND_COOLDOWN_S = 30;

// Account type the visitor is creating. 'school' maps to the backend
// 'school_admin' role. Students go live immediately; teachers + schools are
// created pending an admin/organizer approval before their portal unlocks.
// The visitor picks one on a cards screen FIRST, then the form opens.
type RoleKey = 'student' | 'teacher' | 'school';
const ROLE_CARDS = [
  { value: 'student', labelKey: 'creg.roleStudent', descKey: 'creg.roleStudentDesc', icon: GraduationCap },
  { value: 'teacher', labelKey: 'creg.roleTeacher', descKey: 'creg.roleTeacherDesc', icon: BookOpen },
  { value: 'school', labelKey: 'creg.roleSchool', descKey: 'creg.roleSchoolDesc', icon: Building2 },
] as const;

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

  const [step, setStep] = useState<'role' | 'form' | 'verify'>('role');

  const [role, setRole] = useState<RoleKey>('student');
  // Teacher + school extras (minimal set). fullName doubles as the school
  // coordinator's name when role === 'school'.
  const [schoolName, setSchoolName] = useState('');
  const [npsn, setNpsn] = useState('');
  const [subject, setSubject] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [country, setCountry] = useState<string | null>(null);
  // Province + city moved into the profile editor — registration only asks for
  // country (it gates international catalog visibility + voucher scoping).
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [warning, setWarning] = useState('');
  const [refCode, setRefCode] = useState<string | null>(null);

  // Verification-step state.
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [notice, setNotice] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneValid = phone === '' || /^\+?\d{8,15}$/.test(phone.replace(/[\s-]/g, ''));
  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const npsnValid = npsn === '' || /^\d{6,12}$/.test(npsn.trim());
  const roleFieldsValid =
    role === 'student'
      ? true
      : role === 'teacher'
        ? !!schoolName.trim() && !!npsn.trim() && npsnValid && !!subject.trim()
        : /* school */ !!schoolName.trim() && !!npsn.trim() && npsnValid;

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

  // Resend cooldown ticker.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  // Focus the code field when entering the verify step.
  useEffect(() => {
    if (step === 'verify') codeInputRef.current?.focus();
  }, [step]);

  const canSubmitForm =
    !sending && consent && !!fullName.trim() && emailValid && !passwordTooShort && password.length >= 8 && password === confirmPassword && phoneValid && roleFieldsValid;

  // ── Step 1: send the verification code ──────────────────────────────────
  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmitForm) return;
    setError('');
    setEmailTaken(false);
    setWarning('');
    setSending(true);
    try {
      const res = await emcHttp.post<SendCodeResponse>('/auth/signup/send-code', { email });
      setDevCode(res.devBypass ? res.devCode ?? null : null);
      setCode('');
      setVerifyError('');
      setNotice('');
      setResendIn(RESEND_COOLDOWN_S);
      setStep('verify');
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        setEmailTaken(true);
      } else {
        setError(err instanceof Error ? err.message : t('creg.errSendCode'));
      }
    } finally {
      setSending(false);
    }
  };

  // ── Resend the code ─────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendIn > 0 || sending) return;
    setVerifyError('');
    setNotice('');
    setSending(true);
    try {
      const res = await emcHttp.post<SendCodeResponse>('/auth/signup/send-code', { email });
      setDevCode(res.devBypass ? res.devCode ?? null : null);
      setNotice(t('creg.codeResent'));
      setResendIn(RESEND_COOLDOWN_S);
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        setEmailTaken(true);
        setStep('form');
      } else {
        setVerifyError(err instanceof Error ? err.message : t('creg.errSendCode'));
      }
    } finally {
      setSending(false);
    }
  };

  // ── Step 2: verify the code + create the account ────────────────────────
  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setVerifyError(t('creg.codeIncomplete'));
      return;
    }
    setVerifyError('');
    setWarning('');
    setCreating(true);
    try {
      const backendRole = role === 'school' ? 'school_admin' : role;
      const roleData =
        role === 'teacher'
          ? { school: schoolName.trim(), npsn: npsn.trim(), subject: subject.trim() }
          : role === 'school'
            ? { schoolName: schoolName.trim(), npsn: npsn.trim() }
            : {};

      await emcHttp.post<SignupResponse>('/auth/signup', {
        email,
        password,
        fullName,
        phone: phone || undefined,
        // Country only matters for students (it gates intl catalog + vouchers).
        country: role === 'student' ? country ?? undefined : undefined,
        role: backendRole,
        roleData,
        consentAccepted: consent,
        verificationCode: code,
      });

      // Teacher + school accounts are created pending approval — they don't
      // auto-enroll in a competition. Send them to the (school) portal, which
      // bounces an unverified account to /school-pending.
      if (role !== 'student') {
        window.location.assign('/school-dashboard');
        return;
      }

      if (comp?.id) {
        // Attribute the new account to its referral, if it arrived via ?ref=.
        if (refCode) {
          emcHttp.post('/referrals/signup', { compId: comp.id, code: refCode }).catch(() => {});
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
      if (err instanceof HttpError && err.body?.code === 'NPSN_TAKEN') {
        setError(t('creg.npsnTaken'));
        setStep('form');
        setCreating(false);
        return;
      }
      const codeErr = err instanceof HttpError && (err.body?.code === 'INVALID_VERIFICATION_CODE' || err.body?.code === 'EMAIL_NOT_VERIFIED');
      const msg = err instanceof Error ? err.message : '';
      if (codeErr || /verification code|invalid or has expired/i.test(msg)) {
        setVerifyError(t('creg.codeInvalid'));
      } else if (err instanceof HttpError && err.status === 409) {
        setEmailTaken(true);
        setStep('form');
      } else {
        setError(msg || t('creg.errDefault'));
        setStep('form');
      }
    } finally {
      setCreating(false);
    }
  };

  if (!config) return null;

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Language + theme toggles — pinned to the top-right of the whole screen */}
      <PublicToggles />

      {/* Form panel — LEFT */}
      <div className="relative flex items-center justify-center bg-background px-6 py-12">
        {step === 'role' ? (
          // ── Step 0: pick an account type ──────────────────────────────────
          <div className="w-full max-w-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              {t('creg.eyebrow')}
            </p>
            <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">{t('creg.rolePickTitle')}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t('creg.rolePickSubtitle')}</p>

            <div className="mt-6 space-y-3">
              {ROLE_CARDS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setRole(c.value);
                    setError('');
                    setEmailTaken(false);
                    setStep('form');
                  }}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <c.icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{t(c.labelKey)}</span>
                    <span className="block text-sm text-muted-foreground">{t(c.descKey)}</span>
                  </span>
                  <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              ))}
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t('creg.haveAccount')}
              <Link href={paths.login} className="font-medium text-primary hover:underline">
                {t('creg.signIn')}
              </Link>
            </p>
          </div>
        ) : step === 'form' ? (
          <div className="w-full max-w-md">
            <button
              type="button"
              onClick={() => {
                setStep('role');
                setError('');
                setEmailTaken(false);
              }}
              className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {t('creg.changeRole')}
            </button>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              {t('creg.eyebrow')}
            </p>
            <h1 className="mt-3 font-serif text-3xl font-medium text-foreground">{t('creg.title')}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {role === 'student' ? t('creg.subtitle') : t('creg.subtitleStaff')}
            </p>

            {role !== 'student' && (
              <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs text-muted-foreground">
                {t('creg.staffNote')}
              </p>
            )}

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

            <form onSubmit={handleSendCode} noValidate className="mt-6 space-y-4">
              <div>
                <Label htmlFor="reg-name" className="mb-1.5 text-xs text-muted-foreground">
                  {role === 'school' ? t('creg.coordinatorName') : t('creg.fullName')}
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
                    <code className="font-mono">08123456789</code>.
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
                    {showPwd ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </button>
                </div>
                {passwordTooShort && (
                  <p className="mt-1 text-xs text-destructive">{t('creg.passwordTooShort')}</p>
                )}
              </div>

              <div>
                <Label htmlFor="reg-pwd2" className="mb-1.5 text-xs text-muted-foreground">
                  {t('creg.confirmPassword')}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="reg-pwd2"
                    type={showPwd ? 'text' : 'password'}
                    className="pl-9"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    aria-invalid={passwordMismatch}
                  />
                </div>
                {passwordMismatch && (
                  <p className="mt-1 text-xs text-destructive">{t('creg.passwordMismatch')}</p>
                )}
              </div>

              {/* Teacher + school extras — the minimum the verifier needs. */}
              {role !== 'student' && (
                <>
                  <div>
                    <Label htmlFor="reg-school" className="mb-1.5 text-xs text-muted-foreground">
                      {t('creg.schoolName')}
                    </Label>
                    <div className="relative">
                      <School className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="reg-school"
                        className="pl-9"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        required
                        autoComplete="organization"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="reg-npsn" className="mb-1.5 text-xs text-muted-foreground">
                      {t('creg.npsn')}
                    </Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="reg-npsn"
                        inputMode="numeric"
                        className="pl-9"
                        value={npsn}
                        onChange={(e) => setNpsn(e.target.value.replace(/\D/g, '').slice(0, 12))}
                        required
                        aria-invalid={npsn.length > 0 && !npsnValid}
                      />
                    </div>
                    {npsn.length > 0 && !npsnValid && (
                      <p className="mt-1 text-xs text-destructive">{t('creg.npsnInvalid')}</p>
                    )}
                  </div>

                  {role === 'teacher' && (
                    <div>
                      <Label htmlFor="reg-subject" className="mb-1.5 text-xs text-muted-foreground">
                        {t('creg.subject')}
                      </Label>
                      <div className="relative">
                        <BookOpen className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="reg-subject"
                          className="pl-9"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Country only applies to students (intl catalog + voucher scoping). */}
              {role === 'student' && (
                <div>
                  <Label htmlFor="reg-country" className="mb-1.5 text-xs text-muted-foreground">
                    {t('creg.country')}
                  </Label>
                  <CountrySelect id="reg-country" value={country} onChange={setCountry} />
                  <p className="mt-1 text-xs text-muted-foreground">{t('creg.countryHint')}</p>
                </div>
              )}

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

              <Button type="submit" size="lg" className="w-full" disabled={!canSubmitForm}>
                {sending ? t('creg.sendingCode') : compLoading ? t('creg.loading') : t('creg.continue')}
                {!sending && !compLoading && <ArrowRight className="size-4" />}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              {t('creg.haveAccount')}
              <Link href={paths.login} className="font-medium text-primary hover:underline">
                {t('creg.signIn')}
              </Link>
            </p>
          </div>
        ) : (
          // ── Step 2: verify email ──────────────────────────────────────────
          <div className="w-full max-w-md">
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setVerifyError('');
                setNotice('');
              }}
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {t('creg.changeEmail')}
            </button>

            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MailCheck className="size-6" />
            </span>
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
              {t('creg.verifyEyebrow')}
            </p>
            <h1 className="mt-2 font-serif text-3xl font-medium text-foreground">{t('creg.verifyTitle')}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t('creg.verifySubtitlePre')}
              <span className="font-medium text-foreground">{email}</span>
              {t('creg.verifySubtitlePost')}
            </p>

            {devCode && (
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-primary">
                {t('creg.devBypassNote', { code: devCode })}
              </div>
            )}
            {notice && (
              <div className="mt-4 rounded-lg border border-emerald-300/50 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                {notice}
              </div>
            )}
            {verifyError && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {verifyError}
              </div>
            )}

            <form onSubmit={handleVerify} noValidate className="mt-6 space-y-4">
              <div>
                <Label htmlFor="reg-code" className="mb-1.5 text-xs text-muted-foreground">
                  {t('creg.verifyCodeLabel')}
                </Label>
                <Input
                  id="reg-code"
                  ref={codeInputRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setVerifyError('');
                  }}
                  className="text-center font-mono text-2xl tracking-[0.5em]"
                  aria-invalid={!!verifyError}
                />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={creating || code.length !== 6}>
                {creating ? t('creg.verifying') : t('creg.verifyCta')}
                {!creating && <ArrowRight className="size-4" />}
              </Button>
            </form>

            <button
              type="button"
              onClick={handleResend}
              disabled={resendIn > 0 || sending}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
            >
              <RotateCw className="size-3.5" />
              {resendIn > 0 ? t('creg.resendIn', { s: String(resendIn) }) : t('creg.resend')}
            </button>
          </div>
        )}
      </div>

      {/* Brand panel — RIGHT. The "every competition, one arena" showcase
          (same for every competition) makes it clear arena.competzy.com is a
          continuation of the marketing site the student came from. */}
      <CompetzyBrandPanel showcase />
    </div>
  );
}
