'use client';

import { useRouter } from 'next/navigation';
import { useSchool } from '@/lib/auth/school-context';

export default function SchoolPendingPage() {
  const router = useRouter();
  const { user, logout } = useSchool();

  const status = user?.schoolVerificationStatus;
  const reason = user?.schoolRejectionReason;
  const isRejected = status === 'rejected';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div className="card" style={{ maxWidth: 520, padding: 36, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>{isRejected ? '⚠️' : '⏳'}</div>
        <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 26, fontWeight: 400, marginBottom: 12 }}>
          {isRejected ? 'Application Rejected' : 'Verification In Progress'}
        </h1>

        {isRejected ? (
          <>
            <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
              Your school application was rejected.
            </p>
            {reason && (
              <p style={{ color: 'var(--text-1)', fontSize: 13, lineHeight: 1.6, background: 'var(--bg-2)', padding: 16, borderRadius: 10, marginTop: 12, textAlign: 'left' }}>
                <strong>Reason:</strong> {reason}
              </p>
            )}
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 12 }}>
              Contact <a href="mailto:hello@competzy.com">hello@competzy.com</a> if you'd like to address the issue and re-apply.
            </p>
          </>
        ) : (
          <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
            Your school is currently being reviewed. You'll receive a notification at the email
            on your account once verified — usually within 1 business day. The school portal
            (Bulk Registration, Bulk Payment, Reports) will unlock immediately after.
          </p>
        )}

        <button
          className="btn btn-ghost"
          onClick={async () => { await logout(); router.replace('/'); }}
          style={{ marginTop: 24 }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
