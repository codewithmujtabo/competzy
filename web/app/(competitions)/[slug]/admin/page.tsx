'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { emcHttp } from '@/lib/api/client';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';

interface PendingRow {
  registrationId: string;
  status: string;
  registeredAt: string;
  student: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    school: string | null;
    grade: string | null;
    nisn: string | null;
  };
  competition: { id: string; name: string; fee: number };
}

type StatusFilter = 'pending_review' | 'pending_payment' | 'paid' | 'rejected' | 'all';

export default function CompetitionAdminPage() {
  const params = useParams<{ slug: string }>();
  const slug   = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths  = competitionPaths(slug);

  const router = useRouter();
  const { logout } = useCompetitionAuth();
  const { comp }   = usePortalComp(slug);

  const [rows, setRows]       = useState<PendingRow[] | null>(null);
  const [status, setStatus]   = useState<StatusFilter>('pending_review');
  const [busy, setBusy]       = useState<string | null>(null);
  const [err, setErr]         = useState<string | null>(null);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  const refresh = async () => {
    if (!comp?.id) return;
    setRows(null); setErr(null);
    try {
      const qp = new URLSearchParams({ compId: comp.id, status });
      const data = await emcHttp.get<{ pendingRegistrations: PendingRow[] }>(`/admin/registrations/pending?${qp.toString()}`);
      setRows(data.pendingRegistrations);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    }
  };

  useEffect(() => { void refresh(); }, [comp?.id, status]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id); setErr(null);
    try {
      const body = action === 'reject' ? { reason: 'Reviewed in competition admin' } : {};
      await emcHttp.post(`/admin/registrations/${id}/${action}`, body);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    await logout();
    router.replace(paths.login);
  };

  if (!config) return null;

  return (
    <div className="portal-page" style={{ ['--portal-accent' as string]: config.accent }}>
      <div className="portal-page-inner" style={{ maxWidth: 1100 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <span className="form-eyebrow">{config.shortName} 2026 · Admin</span>
            <h1 style={{ fontFamily: 'var(--ff-display)', fontWeight: 400, fontSize: 28, color: '#0d0d1a', margin: '4px 0 0' }}>
              Registrations
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Link href="/dashboard" style={{ color: config.accent, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
              ← Full admin
            </Link>
            <button onClick={signOut} className="link" style={{ background: 'none', border: 'none', color: '#6b6b80', cursor: 'pointer', fontSize: 13 }}>
              Sign out
            </button>
          </div>
        </header>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {(['pending_review', 'pending_payment', 'paid', 'rejected', 'all'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                font: '500 12px/1 var(--ff-mono)',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                padding: '8px 14px',
                borderRadius: 999,
                border: status === s ? `1px solid ${config.accent}` : '1px solid #e4e4ee',
                background: status === s ? `${config.accent}14` : '#fff',
                color: status === s ? config.accent : '#6b6b80',
                cursor: 'pointer',
              }}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {err && <div className="portal-error">{err}</div>}

        {!comp?.id ? (
          <div className="portal-toast">{config.shortName} 2026 isn’t configured. Run the latest backend migration first.</div>
        ) : rows === null ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b6b80' }}>
            <div className="spin" style={{ margin: '0 auto 14px' }} />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b6b80', background: '#f7f7fb', borderRadius: 12 }}>
            No {status.replace(/_/g, ' ')} registrations for {config.shortName} 2026.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #ececf4' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ background: '#f7f7fb' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: 12, color: '#6b6b80', font: '500 10px/1 var(--ff-mono)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Student</th>
                  <th style={{ textAlign: 'left', padding: 12, color: '#6b6b80', font: '500 10px/1 var(--ff-mono)', textTransform: 'uppercase', letterSpacing: '.1em' }}>School</th>
                  <th style={{ textAlign: 'left', padding: 12, color: '#6b6b80', font: '500 10px/1 var(--ff-mono)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Grade</th>
                  <th style={{ textAlign: 'left', padding: 12, color: '#6b6b80', font: '500 10px/1 var(--ff-mono)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: 12, color: '#6b6b80', font: '500 10px/1 var(--ff-mono)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.registrationId} style={{ borderTop: '1px solid #ececf4' }}>
                    <td style={{ padding: 12, color: '#0d0d1a' }}>
                      <div style={{ fontWeight: 500 }}>{r.student.name}</div>
                      <div style={{ color: '#6b6b80', fontSize: 12 }}>{r.student.email}</div>
                    </td>
                    <td style={{ padding: 12, color: '#4c4c6a' }}>{r.student.school || '—'}</td>
                    <td style={{ padding: 12, color: '#4c4c6a' }}>{r.student.grade || '—'}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{ font: '500 11px/1 var(--ff-mono)', padding: '4px 10px', borderRadius: 999, background: `${config.accent}10`, color: config.accent }}>
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {r.status === 'pending_review' && (
                        <>
                          <button
                            onClick={() => act(r.registrationId, 'approve')}
                            disabled={busy === r.registrationId}
                            style={{ padding: '6px 12px', marginRight: 6, borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => act(r.registrationId, 'reject')}
                            disabled={busy === r.registrationId}
                            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
