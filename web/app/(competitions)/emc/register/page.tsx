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
  const [warning, setWarning]     = useState('');
  const [submitting, setSubmit]   = useState(false);

  // Already-logged-in: send straight to the right destination.
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(user.role === 'admin' ? EMC.adminPath : EMC.dashboardPath);
    }
  }, [user, authLoading, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setWarning(''); setSubmit(true);
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
      setError(err instanceof Error ? err.message : 'Sign-up failed');
    } finally {
      setSubmit(false);
    }
  };

  const canSubmit = !submitting && consent && fullName && email && password;

  return (
    <SplitScreenAuth config={EMC}>
      <span className="form-eyebrow">EMC 2026 · Create Account</span>
      <h1>Join the championship.</h1>
      <p className="form-subtitle">
        Sign up once and we’ll enroll you in EMC 2026 automatically.
      </p>

      {error && <div className="portal-error">{error}</div>}
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
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
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
            />
          </div>
        </div>

        <div className="form-row">
          <label className="label-light" htmlFor="emc-pwd">Password (min 6 chars)</label>
          <div className="icon-input-wrap">
            <LockIcon />
            <input
              id="emc-pwd"
              className="input-light has-suffix"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
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
