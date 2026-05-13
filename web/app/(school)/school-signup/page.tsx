'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SUCCESS_MSG = "Application received. Our team will verify your school within 1 business day. You'll receive a notification at the email below once approved.";

export default function SchoolSignupPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    schoolName: '',
    npsn: '',
    address: '',
    city: '',
    province: '',
    contactPhone: '',
    verificationLetterUrl: '',
    applicantName: '',
    applicantEmail: '',
    applicantPassword: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setSubmitting(true);

    try {
      const res = await fetch('/api/schools/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? 'Signup failed');
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
        <div className="card" style={{ maxWidth: 480, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>📨</div>
          <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 24, fontWeight: 400, marginBottom: 12 }}>Application Received</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>{SUCCESS_MSG}</p>
          <button
            className="btn btn-primary"
            onClick={() => router.replace('/')}
            style={{ marginTop: 24, background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', padding: '11px 24px' }}
          >
            Continue to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 24px', background: 'radial-gradient(ellipse at 60% 0%,rgba(34,197,94,.07) 0%,transparent 60%),var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <Link href="/" style={{ color: 'var(--text-3)', fontSize: 13, fontFamily: 'var(--ff-mono)' }}>← Back</Link>
        <div style={{ textAlign: 'center', margin: '24px 0 32px' }}>
          <div style={{ fontSize: 48 }}>🏫</div>
          <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 28, fontWeight: 400, marginTop: 12 }}>Apply as a School</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 6 }}>
            Tell us about your school and the coordinator who'll manage registrations.
          </p>
        </div>

        {error && <div className="toast toast-err" style={{ marginBottom: 16 }}>⚠ {error}</div>}

        <form onSubmit={submit} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="label" style={{ marginBottom: 0, marginTop: 0 }}>School details</p>

          <div>
            <label className="label">School name *</label>
            <input className="input" required value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">NPSN *</label>
              <input className="input" required value={form.npsn} onChange={(e) => setForm({ ...form, npsn: e.target.value })} placeholder="10-digit code" />
            </div>
            <div>
              <label className="label">Contact phone</label>
              <input className="input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+62…" />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="label">Province</label>
              <input className="input" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Verification letter URL</label>
            <input className="input" type="url" value={form.verificationLetterUrl} onChange={(e) => setForm({ ...form, verificationLetterUrl: e.target.value })} placeholder="https://…/letter.pdf" />
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Optional. Upload a letter signed by the principal somewhere accessible (Drive, MinIO, etc.) and paste the link.</p>
          </div>

          <p className="label" style={{ marginTop: 8, marginBottom: 0 }}>Coordinator account</p>
          <div>
            <label className="label">Full name *</label>
            <input className="input" required value={form.applicantName} onChange={(e) => setForm({ ...form, applicantName: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" required value={form.applicantEmail} onChange={(e) => setForm({ ...form, applicantEmail: e.target.value })} />
            </div>
            <div>
              <label className="label">Password *</label>
              <input className="input" type="password" required minLength={6} value={form.applicantPassword} onChange={(e) => setForm({ ...form, applicantPassword: e.target.value })} placeholder="min 6 chars" />
            </div>
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={submitting}
            style={{ marginTop: 8, background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none', padding: '12px', fontSize: 14 }}
          >
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: 'var(--text-3)' }}>
          Already have an account? <Link href="/" style={{ color: '#22c55e', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
