'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

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

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/schools/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? 'Signup failed');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-md gap-0 p-9 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <MailCheck className="size-7" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-medium text-foreground">Application received</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Our team will verify your school within one business day. You’ll get an email at the
            address you provided once it’s approved.
          </p>
          <Button className="mt-6" onClick={() => router.replace('/')}>
            Continue to sign in
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 px-6 py-10">
      <div className="mx-auto w-full max-w-xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>

        <div className="mb-7 mt-6 text-center">
          <h1 className="font-serif text-3xl font-medium text-foreground">Apply as a school</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tell us about your school and the coordinator who’ll manage registrations.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <Card className="gap-4 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              School details
            </p>
            <Field label="School name" required>
              <Input required value={form.schoolName} onChange={(e) => set({ schoolName: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="NPSN" required>
                <Input
                  required
                  value={form.npsn}
                  onChange={(e) => set({ npsn: e.target.value })}
                  placeholder="10-digit code"
                />
              </Field>
              <Field label="Contact phone">
                <Input
                  value={form.contactPhone}
                  onChange={(e) => set({ contactPhone: e.target.value })}
                  placeholder="+62…"
                />
              </Field>
            </div>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => set({ address: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City">
                <Input value={form.city} onChange={(e) => set({ city: e.target.value })} />
              </Field>
              <Field label="Province">
                <Input value={form.province} onChange={(e) => set({ province: e.target.value })} />
              </Field>
            </div>
            <Field
              label="Verification letter URL"
              hint="Optional — upload a principal-signed letter somewhere accessible (Drive, etc.) and paste the link."
            >
              <Input
                type="url"
                value={form.verificationLetterUrl}
                onChange={(e) => set({ verificationLetterUrl: e.target.value })}
                placeholder="https://…/letter.pdf"
              />
            </Field>

            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Coordinator account
            </p>
            <Field label="Full name" required>
              <Input
                required
                value={form.applicantName}
                onChange={(e) => set({ applicantName: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" required>
                <Input
                  type="email"
                  required
                  value={form.applicantEmail}
                  onChange={(e) => set({ applicantEmail: e.target.value })}
                />
              </Field>
              <Field label="Password" required>
                <Input
                  type="password"
                  required
                  minLength={6}
                  value={form.applicantPassword}
                  onChange={(e) => set({ applicantPassword: e.target.value })}
                  placeholder="min 6 characters"
                />
              </Field>
            </div>

            <Button type="submit" className="mt-2" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit application'}
            </Button>
          </Card>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
