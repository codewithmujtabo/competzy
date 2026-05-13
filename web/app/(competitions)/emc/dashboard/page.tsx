'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { emcHttp } from '@/lib/api/client';
import { useEmcAuth } from '@/lib/auth/emc-context';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { EMC } from '@/lib/competitions/emc';

interface RegistrationRow {
  id: string;
  compId: string;
  status: string;
  registrationNumber: string | null;
}

const STATUS_COPY: Record<string, { title: string; body: string; cta?: string }> = {
  pending_payment: {
    title: 'Your seat is held.',
    body:  'Complete your payment to lock in your EMC 2026 spot.',
    cta:   'Continue to payment',
  },
  pending_review: {
    title: 'Awaiting admin review.',
    body:  'We’re reviewing your registration. You’ll be notified by email.',
  },
  registered: {
    title: 'You’re registered.',
    body:  'Materials and your test-center details will arrive closer to the date.',
  },
  paid: {
    title: 'You’re in.',
    body:  'Payment confirmed. Materials and test-center details will follow.',
  },
  rejected: {
    title: 'Registration declined.',
    body:  'Please contact support if you believe this is in error.',
  },
};

export default function EmcDashboardPage() {
  const { user, logout } = useEmcAuth();
  const { comp } = usePortalComp(EMC.slug);
  const router = useRouter();

  const [regs, setRegs]     = useState<RegistrationRow[] | null>(null);
  const [enroll, setEnroll] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  const refresh = async (compId?: string | null) => {
    try {
      const q = compId ? `?compId=${encodeURIComponent(compId)}` : '';
      const rows = await emcHttp.get<RegistrationRow[]>(`/registrations${q}`);
      setRegs(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load registrations');
    }
  };

  useEffect(() => {
    if (comp?.id) void refresh(comp.id);
  }, [comp?.id]);

  const enrollNow = async () => {
    if (!comp?.id) return;
    setEnroll(true); setErr(null);
    try {
      await emcHttp.post('/registrations', { id: crypto.randomUUID(), compId: comp.id });
      await refresh(comp.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (!/already exists/i.test(msg)) setErr(msg || 'Enroll failed');
      else await refresh(comp.id);
    } finally {
      setEnroll(false);
    }
  };

  const signOut = async () => {
    await logout();
    router.replace(EMC.loginPath);
  };

  const reg = regs?.[0];
  const copy = reg ? STATUS_COPY[reg.status] : null;

  return (
    <div className="portal-page" style={{ ['--portal-accent' as string]: EMC.accent }}>
      <div className="portal-page-inner">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <span className="form-eyebrow">{EMC.shortName} 2026</span>
            <h1 style={{ fontFamily: 'var(--ff-display)', fontWeight: 400, fontSize: 28, color: '#0d0d1a', margin: '4px 0 0' }}>
              Hi {user?.fullName || user?.full_name || 'there'} 👋
            </h1>
          </div>
          <button onClick={signOut} className="link" style={{ background: 'none', border: 'none', color: '#6b6b80', cursor: 'pointer', fontSize: 13 }}>
            Sign out
          </button>
        </header>

        {err && <div className="portal-error">{err}</div>}

        {!regs ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b6b80' }}>
            <div className="spin" style={{ margin: '0 auto 14px' }} />
            Loading your registration…
          </div>
        ) : reg ? (
          <div style={{ background: '#f7f7fb', borderRadius: 14, padding: 28 }}>
            <div style={{ font: '500 11px/1 var(--ff-mono)', textTransform: 'uppercase', letterSpacing: '.12em', color: EMC.accent, marginBottom: 8 }}>
              Status · {reg.status.replace(/_/g, ' ')}
            </div>
            <h2 style={{ fontFamily: 'var(--ff-display)', fontWeight: 400, fontSize: 22, color: '#0d0d1a', margin: '4px 0 8px' }}>
              {copy?.title ?? 'Registration recorded.'}
            </h2>
            <p style={{ color: '#4c4c6a', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
              {copy?.body ?? `Status: ${reg.status}`}
            </p>
            {reg.registrationNumber && (
              <div style={{ font: '500 12px/1 var(--ff-mono)', color: '#6b6b80' }}>
                Registration #&nbsp;{reg.registrationNumber}
              </div>
            )}
            {copy?.cta && (
              <button className="btn-portal" style={{ marginTop: 20, width: 'auto', padding: '12px 22px' }} disabled>
                {copy.cta} (wiring soon)
              </button>
            )}
          </div>
        ) : (
          <div style={{ background: '#f7f7fb', borderRadius: 14, padding: 32, textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--ff-display)', fontWeight: 400, fontSize: 22, color: '#0d0d1a', marginBottom: 8 }}>
              Welcome to EMC 2026
            </h2>
            <p style={{ color: '#4c4c6a', fontSize: 14, marginBottom: 22 }}>
              You don’t have a registration yet. Enroll now to claim your spot.
            </p>
            <button className="btn-portal" onClick={enrollNow} disabled={enroll || !comp?.id} style={{ width: 'auto', padding: '12px 22px' }}>
              {enroll ? 'Enrolling…' : 'Register for EMC 2026'}
            </button>
            {!comp?.id && (
              <p style={{ color: '#a04400', fontSize: 12, marginTop: 12 }}>
                EMC 2026 isn’t configured yet. Ask an admin to run the latest migration.
              </p>
            )}
          </div>
        )}

        <div style={{ marginTop: 28, padding: 18, border: '1px dashed #d8d8e6', borderRadius: 12, color: '#6b6b80', fontSize: 13 }}>
          The full student EMC experience (materials, sessions, certificates) is coming next.
          For now this dashboard shows your registration status only.{' '}
          <Link href="/" style={{ color: EMC.accent, fontWeight: 500 }}>Visit Competzy hub →</Link>
        </div>
      </div>
    </div>
  );
}
