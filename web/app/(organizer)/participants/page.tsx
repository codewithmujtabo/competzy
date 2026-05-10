'use client';

import { useState, useEffect } from 'react';
import { organizerHttp } from '@/lib/auth/organizer-context';

interface Competition { id: string; name: string; registrationCount: number; }
interface Registration {
  id: string;
  status: string;
  registrationNumber?: string;
  createdAt: string;
  student: { id: string; fullName: string; email: string; phone?: string; school?: string; grade?: string; };
  payment: { status: string; amount: number; } | null;
}

const STATUS_CLS: Record<string, string> = {
  pending_approval: 'badge-yellow',  // not paid, awaiting first admin gate
  registered:       'badge-indigo',  // approved pre-payment, can pay
  pending_review:   'badge-blue',    // paid, awaiting final review
  approved:         'badge-green',   // fully approved
  paid:             'badge-green',   // legacy: same as approved
  rejected:         'badge-red',
};

const ACTIONABLE_STATUSES = new Set(['pending_approval', 'pending_review']);

function Spinner() { return <span className="spin" />; }

export default function OrganizerParticipants() {
  const [comps, setComps]         = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState('');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading]     = useState(false);
  const [loadingComps, setLoadingComps] = useState(true);
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy]           = useState<string | null>(null);
  const [rejectId, setRejectId]   = useState<string | null>(null);
  const [reason, setReason]       = useState('');

  useEffect(() => {
    organizerHttp.get<Competition[]>('/organizers/competitions')
      .then(r => setComps(r))
      .catch(e => setMsg({ ok: false, text: (e as Error).message }))
      .finally(() => setLoadingComps(false));
  }, []);

  useEffect(() => {
    if (!selectedComp) return;
    setLoading(true);
    organizerHttp.get<Registration[]>(`/organizers/competitions/${selectedComp}/registrations`)
      .then(r => setRegistrations(r))
      .catch(e => setMsg({ ok: false, text: (e as Error).message }))
      .finally(() => setLoading(false));
  }, [selectedComp]);

  const approve = async (id: string) => {
    setBusy(id);
    try {
      await organizerHttp.post(`/organizers/registrations/${id}/approve`, {});
      setMsg({ ok: true, text: 'Registration approved — student notified.' });
      if (selectedComp) {
        const r = await organizerHttp.get<Registration[]>(`/organizers/competitions/${selectedComp}/registrations`);
        setRegistrations(r);
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectId || !reason.trim()) return;
    setBusy(rejectId);
    try {
      await organizerHttp.post(`/organizers/registrations/${rejectId}/reject`, { reason: reason.trim() });
      setMsg({ ok: true, text: 'Registration rejected — student notified.' });
      if (selectedComp) {
        const r = await organizerHttp.get<Registration[]>(`/organizers/competitions/${selectedComp}/registrations`);
        setRegistrations(r);
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
      setRejectId(null);
      setReason('');
    }
  };

  const exportCsv = () => {
    if (!selectedComp) return;
    window.open(`/api/organizers/competitions/${selectedComp}/export`, '_blank');
  };

  return (
    <div style={{ padding: '36px 40px', maxWidth: 1060 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div className="fu">
          <p className="label" style={{ marginBottom: 6 }}>Management</p>
          <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 32, fontWeight: 400 }}>Participants</h1>
        </div>
        {selectedComp && (
          <button className="btn btn-ghost" onClick={exportCsv} style={{ marginBottom: 28 }}>
            ↓ Export CSV
          </button>
        )}
      </div>

      {msg && <div className={`toast ${msg.ok ? 'toast-ok' : 'toast-err'}`} style={{ marginBottom: 16 }}>{msg.ok ? '✓' : '⚠'} {msg.text}</div>}

      {/* Reject modal */}
      {rejectId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }}>
          <div className="card" style={{ width: 420, padding: 28 }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Reject Registration</div>
            <textarea
              className="input"
              rows={3}
              placeholder="Reason for rejection (required)…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ width: '100%', resize: 'vertical', marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setRejectId(null); setReason(''); }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ background: '#EF4444', borderColor: '#EF4444' }}
                disabled={!reason.trim() || busy === rejectId}
                onClick={handleRejectSubmit}
              >
                {busy === rejectId ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Competition selector */}
      <div style={{ marginBottom: 20 }}>
        <label className="label">Select Competition</label>
        <select className="input" style={{ maxWidth: 400 }} value={selectedComp} onChange={e => setSelectedComp(e.target.value)}>
          <option value="">— choose a competition —</option>
          {loadingComps
            ? <option disabled>Loading…</option>
            : comps.map(c => <option key={c.id} value={c.id}>{c.name} ({c.registrationCount} registrations)</option>)}
        </select>
      </div>

      {!selectedComp ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          Select a competition above to view participants
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center' }}><Spinner /></div>
            ) : registrations.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No registrations yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>School</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>Grade</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>Payment</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>Registered</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map(r => (
                    <tr key={r.id}>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-1)', fontWeight: 500 }}>
                        <div>{r.student.fullName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--ff-mono)' }}>{r.student.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontSize: 12 }}>{r.student.school || '—'}</td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontSize: 12 }}>{r.student.grade || '—'}</td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
                        <span className={`badge ${STATUS_CLS[r.status] ?? 'badge-gray'}`}>{r.status}</span>
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
                        {r.payment
                          ? <span className={`badge ${r.payment.status === 'settlement' || r.payment.status === 'capture' ? 'badge-green' : 'badge-yellow'}`}>
                              {r.payment.status}
                            </span>
                          : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontFamily: 'var(--ff-mono)', fontSize: 11 }}>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
                        {ACTIONABLE_STATUSES.has(r.status) ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary"
                              disabled={busy === r.id}
                              onClick={() => approve(r.id)}
                              style={{ padding: '4px 10px', fontSize: 11, background: '#22c55e', border: 'none' }}>
                              {busy === r.id ? '…' : 'Approve'}
                            </button>
                            <button className="btn btn-danger"
                              disabled={busy === r.id}
                              onClick={() => { setRejectId(r.id); setReason(''); }}
                              style={{ padding: '4px 10px', fontSize: 11 }}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}