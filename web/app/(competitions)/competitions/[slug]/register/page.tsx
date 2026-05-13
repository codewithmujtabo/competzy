'use client';

// Per-competition registration page. Reads the slug from the URL, resolves
// the portal config from the registry, and renders the SplitScreenAuth shell
// with the matching brand. Auto-enrolls the new student into the matching
// `competitions` row on signup success.

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { emcHttp } from '@/lib/api/client';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { SplitScreenAuth } from '@/components/competition-portal/SplitScreenAuth';
import {
  MailIcon, LockIcon, UserIcon, PhoneIcon, MapPinIcon,
  EyeIcon, EyeOffIcon, ArrowRightIcon,
} from '@/components/competition-portal/icons';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';

type SignupResponse = { token: string; user: { id: string; role: string } };

export default function CompetitionRegisterPage() {
  const params = useParams<{ slug: string }>();
  const slug   = params?.slug ?? '';
  const config = getCompetitionConfig(slug);

  // useEffect to call notFound so it runs in the Suspense boundary; calling
  // notFound() at module load would throw during static analysis.
  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  const paths = competitionPaths(slug);
  const { user, loading: authLoading } = useCompetitionAuth();
  const { comp, loading: compLoading } = usePortalComp(slug);

  const [fullName, setFullName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [city, setCity]           = useState('');
  const [province, setProvince]   = useState('');
  const [consent, setConsent]     = useState(false);
  const [error, setError]         = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [warning, setWarning]     = useState('');
  const [submitting, setSubmit]   = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneValid = phone === '' || /^\+?\d{8,15}$/.test(phone.replace(/[\s-]/g, ''));
  const passwordTooShort = password.length > 0 && password.length < 8;

  useEffect(() => {
    if (!authLoading && user) {
      window.location.assign(user.role === 'admin' ? paths.admin : paths.dashboard);
    }
  }, [user, authLoading, paths.admin, paths.dashboard]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailValid || password.length < 8 || !consent || !phoneValid) return;
    setError(''); setEmailTaken(false); setWarning(''); setSubmit(true);
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
        try {
          await emcHttp.post('/registrations', {
            id: crypto.randomUUID(),
            compId: comp.id,
          });
        } catch (regErr) {
          const msg = regErr instanceof Error ? regErr.message : '';
          if (!/already exists/i.test(msg)) {
            setWarning(`Account created, but we couldn’t auto-enroll you in ${config?.wordmark ?? 'this competition'}: ${msg || 'unknown error'}. You can register from the dashboard.`);
            setTimeout(() => window.location.assign(paths.dashboard), 1200);
            return;
          }
        }
      } else {
        setWarning(`Account created, but ${config?.wordmark ?? 'this competition'} isn’t configured in the database yet. Run the latest migration to enable enrollment.`);
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
    !submitting &&
    consent &&
    !!fullName.trim() &&
    emailValid &&
    !passwordTooShort &&
    password.length >= 8 &&
    phoneValid;

  if (!config) return null;

  return (
    <SplitScreenAuth config={config}>
      <span className="form-eyebrow">{config.shortName} · Create Account</span>
      <h1>Join the championship.</h1>
      <p className="form-subtitle">
        Sign up once and we&rsquo;ll enroll you in {config.wordmark} automatically.
      </p>

      {error && <div className="portal-error">{error}</div>}
      {emailTaken && (
        <div className="portal-error">
          That email is already registered.{' '}
          <Link href="/" style={{ textDecoration: 'underline', fontWeight: 600 }}>
            Sign in instead
          </Link>{' '}
          or use Forgot password.
        </div>
      )}
      {warning && <div className="portal-toast">{warning}</div>}

      <form onSubmit={submit} noValidate>
        <div className="form-row">
          <label className="label-light" htmlFor="reg-name">Full name</label>
          <div className="icon-input-wrap">
            <UserIcon />
            <input
              id="reg-name"
              className="input-light"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
        </div>

        <div className="form-row">
          <label className="label-light" htmlFor="reg-email">Email</label>
          <div className="icon-input-wrap">
            <MailIcon />
            <input
              id="reg-email"
              className="input-light"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailTaken(false); }}
              required
              autoComplete="email"
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
          <label className="label-light" htmlFor="reg-phone">Phone (E.164, optional)</label>
          <div className="icon-input-wrap">
            <PhoneIcon />
            <input
              id="reg-phone"
              className="input-light"
              type="tel"
              placeholder="+62…"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              autoComplete="tel"
              aria-invalid={!phoneValid}
            />
          </div>
          {!phoneValid && (
            <div className="portal-hint" role="alert">
              Use the international format, e.g. <code>+628123456789</code>.
            </div>
          )}
        </div>

        <div className="form-row">
          <label className="label-light" htmlFor="reg-pwd">Password (min 8 chars)</label>
          <div className="icon-input-wrap">
            <LockIcon />
            <input
              id="reg-pwd"
              className="input-light has-suffix"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              aria-invalid={passwordTooShort}
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
          {passwordTooShort && (
            <div className="portal-hint" role="alert">
              Password must be at least 8 characters.
            </div>
          )}
        </div>

        <div className="form-grid-2">
          <div className="form-row">
            <label className="label-light" htmlFor="reg-city">City (optional)</label>
            <div className="icon-input-wrap">
              <MapPinIcon />
              <input
                id="reg-city"
                className="input-light"
                value={city}
                onChange={e => setCity(e.target.value)}
                autoComplete="address-level2"
              />
            </div>
          </div>
          <div className="form-row">
            <label className="label-light" htmlFor="reg-prov">Province (optional)</label>
            <div className="icon-input-wrap">
              <MapPinIcon />
              <input
                id="reg-prov"
                className="input-light"
                value={province}
                onChange={e => setProvince(e.target.value)}
                autoComplete="address-level1"
              />
            </div>
          </div>
        </div>

        <label className="portal-checkbox">
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            required
          />
          <span>
            I agree to the Competzy <Link href="/terms">Terms of Service</Link> and{' '}
            <Link href="/privacy">Privacy Policy</Link>, and consent to processing of my
            data for the purposes of {config.wordmark} registration.
          </span>
        </label>

        <button className="btn-portal" type="submit" disabled={!canSubmit}>
          {submitting ? 'Creating account…' : compLoading ? 'Loading…' : 'Create Account'}
          {!submitting && !compLoading && <ArrowRightIcon />}
        </button>
      </form>

      <div className="portal-switch">
        Already have an account?&nbsp;
        <Link href={paths.login}>Sign in</Link>
      </div>
    </SplitScreenAuth>
  );
}
