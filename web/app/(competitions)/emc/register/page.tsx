'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { emcHttp } from '@/lib/api/client';
import { useEmcAuth } from '@/lib/auth/emc-context';
import { SplitScreenAuth } from '@/components/competition-portal/SplitScreenAuth';
import {
  MailIcon, LockIcon, UserIcon, PhoneIcon, MapPinIcon,
  EyeIcon, EyeOffIcon, ArrowRightIcon,
} from '@/components/competition-portal/icons';
import { EMC } from '@/lib/competitions/emc';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';

type SignupResponse = { token: string; user: { id: string; role: string } };

export default function EmcRegisterPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useEmcAuth();
  const { comp, loading: compLoading } = usePortalComp(EMC.slug);

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

  // Light client-side validation. Backend re-validates everything.
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneValid = phone === '' || /^\+?\d{8,15}$/.test(phone.replace(/[\s-]/g, ''));
  const passwordTooShort = password.length > 0 && password.length < 8;

  // Already-logged-in: send straight to the right destination.
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(user.role === 'admin' ? EMC.adminPath : EMC.dashboardPath);
    }
  }, [user, authLoading, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailValid || password.length < 8 || !consent || !phoneValid) return;
    setError(''); setEmailTaken(false); setWarning(''); setSubmit(true);
    try {
      // 1. Create the student account (auto-issues auth cookie).
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

      // 2. Auto-enroll in EMC. Wrapped so a missing comp row doesn't lose the user.
      if (comp?.id) {
        try {
          await emcHttp.post('/registrations', {
            id: crypto.randomUUID(),
            compId: comp.id,
          });
        } catch (regErr) {
          // 409 = already registered (fine), anything else = surface a toast.
          const msg = regErr instanceof Error ? regErr.message : '';
          if (!/already exists/i.test(msg)) {
            setWarning(`Account created, but we couldn’t auto-enroll you in EMC 2026: ${msg || 'unknown error'}. You can register from the dashboard.`);
            // Pause briefly so the user sees the warning before nav.
            setTimeout(() => router.replace(EMC.dashboardPath), 1200);
            return;
          }
        }
      } else {
        setWarning('Account created, but EMC 2026 isn’t configured in the database yet. Run the latest migration to enable enrollment.');
        setTimeout(() => router.replace(EMC.dashboardPath), 1500);
        return;
      }

      router.replace(EMC.dashboardPath);
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

  return (
    <SplitScreenAuth config={EMC}>
      <span className="form-eyebrow">EMC 2026 · Create Account</span>
      <h1>Join the championship.</h1>
      <p className="form-subtitle">
        Sign up once and we’ll enroll you in EMC 2026 automatically.
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

      <form onSubmit={submit}>
        <div className="form-row">
          <label className="label-light" htmlFor="emc-name">Full name</label>
          <div className="icon-input-wrap">
            <UserIcon />
            <input
              id="emc-name"
              className="input-light"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
        </div>

        <div className="form-row">
          <label className="label-light" htmlFor="emc-email">Email</label>
          <div className="icon-input-wrap">
            <MailIcon />
            <input
              id="emc-email"
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
          <label className="label-light" htmlFor="emc-phone">Phone (E.164, optional)</label>
          <div className="icon-input-wrap">
            <PhoneIcon />
            <input
              id="emc-phone"
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
          <label className="label-light" htmlFor="emc-pwd">Password (min 8 chars)</label>
          <div className="icon-input-wrap">
            <LockIcon />
            <input
              id="emc-pwd"
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
            <label className="label-light" htmlFor="emc-city">City (optional)</label>
            <div className="icon-input-wrap">
              <MapPinIcon />
              <input
                id="emc-city"
                className="input-light"
                value={city}
                onChange={e => setCity(e.target.value)}
                autoComplete="address-level2"
              />
            </div>
          </div>
          <div className="form-row">
            <label className="label-light" htmlFor="emc-prov">Province (optional)</label>
            <div className="icon-input-wrap">
              <MapPinIcon />
              <input
                id="emc-prov"
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
            data for the purposes of EMC 2026 registration.
          </span>
        </label>

        <button className="btn-portal" type="submit" disabled={!canSubmit}>
          {submitting ? 'Creating account…' : compLoading ? 'Loading…' : 'Create Account'}
          {!submitting && !compLoading && <ArrowRightIcon />}
        </button>
      </form>

      <div className="portal-switch">
        Already have an account?&nbsp;
        <Link href={EMC.loginPath}>Sign in</Link>
      </div>
    </SplitScreenAuth>
  );
}
