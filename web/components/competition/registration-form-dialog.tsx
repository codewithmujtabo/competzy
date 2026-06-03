'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { emcHttp } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// In-dashboard registration form (the mockup's "Formulir Pendaftaran"). Opened
// as a MODAL from the dashboard so the student never leaves the competition
// page to fill it in (the old "Complete profile" button navigated to
// /account/profile, which broke the flow). It round-trips GET/PUT /users/me —
// it loads the full profile, renders the registration subset, and PUTs every
// field back so nothing the modal doesn't show gets cleared.

interface Form {
  fullName: string;
  gender: string;
  grade: string;
  dateOfBirth: string;
  phone: string;
  parentPhone: string;
  npsn: string;
  schoolName: string;
  schoolAddress: string;
  parentName: string;
  parentOccupation: string;
  supervisorName: string;
  // Carried through untouched so the PUT doesn't blank them.
  city: string;
  province: string;
  country: string | null;
  nisn: string;
}

const EMPTY: Form = {
  fullName: '', gender: '', grade: '', dateOfBirth: '', phone: '', parentPhone: '',
  npsn: '', schoolName: '', schoolAddress: '', parentName: '', parentOccupation: '',
  supervisorName: '', city: '', province: '', country: null, nisn: '',
};

function toDateInput(v: string | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function Field({
  label,
  required,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', wide && 'sm:col-span-2')}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function RegistrationFormDialog({
  open,
  onClose,
  compName,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  compName: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastNpsn = useRef<string>('');

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    emcHttp
      .get<Record<string, unknown>>('/users/me')
      .then((d) => {
        if (cancelled) return;
        const s = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
        setForm({
          fullName: s('fullName'),
          gender: s('gender'),
          grade: s('grade'),
          dateOfBirth: toDateInput(s('dateOfBirth') || null),
          phone: s('phone') || s('whatsapp'),
          parentPhone: s('parentPhone') || s('parentWhatsapp'),
          npsn: s('npsn'),
          schoolName: s('schoolName'),
          schoolAddress: s('schoolAddress'),
          parentName: s('parentName'),
          parentOccupation: s('parentOccupation'),
          supervisorName: s('supervisorName'),
          city: s('city'),
          province: s('province'),
          country: typeof d.country === 'string' ? d.country : null,
          nisn: s('nisn'),
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function lookupNpsn() {
    const npsn = form.npsn.trim();
    if (!/^\d{6,12}$/.test(npsn)) {
      toast.error('Enter a valid NPSN first');
      return;
    }
    if (lastNpsn.current === npsn) return;
    try {
      const r = await emcHttp.get<{
        name: string;
        address: string | null;
        city: string | null;
        province: string | null;
      }>(`/schools/by-npsn/${encodeURIComponent(npsn)}`);
      lastNpsn.current = npsn;
      setForm((f) => ({
        ...f,
        schoolName: r.name,
        schoolAddress: r.address ?? f.schoolAddress,
        city: r.city ?? f.city,
        province: r.province ?? f.province,
      }));
      toast.success(`School found: ${r.name}`);
    } catch (e) {
      lastNpsn.current = npsn;
      const msg = e instanceof Error ? e.message : '';
      if (/not found|404/i.test(msg)) toast.message('No school for that NPSN — type the name manually.');
      else toast.error('NPSN lookup failed');
    }
  }

  async function handleSave() {
    if (!form.fullName.trim()) {
      toast.error('Full name is required');
      return;
    }
    setSaving(true);
    try {
      await emcHttp.put<{ message: string }>('/users/me', {
        fullName: form.fullName,
        gender: form.gender || undefined,
        grade: form.grade,
        dateOfBirth: form.dateOfBirth || undefined,
        phone: form.phone,
        parentPhone: form.parentPhone,
        parentWhatsapp: form.parentPhone,
        npsn: form.npsn,
        schoolName: form.schoolName,
        schoolAddress: form.schoolAddress,
        parentName: form.parentName,
        parentOccupation: form.parentOccupation,
        supervisorName: form.supervisorName,
        city: form.city,
        province: form.province,
        country: form.country,
        nisn: form.nisn,
      });
      toast.success('Registration details saved');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registration form · {compName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading your details…</div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                Participant details
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <Input
                    value={form.fullName}
                    onChange={(e) => set('fullName', e.target.value)}
                    placeholder="Name as on documents"
                  />
                </Field>
                <Field label="Gender">
                  <Select value={form.gender} onValueChange={(v) => set('gender', v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Grade">
                  <Select value={form.grade} onValueChange={(v) => set('grade', v)}>
                    <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((g) => (
                        <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date of birth">
                  <Input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
                </Field>
                <Field label="Phone">
                  <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="08xxxxxxxxxx" />
                </Field>
                <Field label="Parent phone">
                  <Input value={form.parentPhone} onChange={(e) => set('parentPhone', e.target.value)} placeholder="08xxxxxxxxxx" />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                School details
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="NPSN">
                  <div className="flex gap-2">
                    <Input
                      value={form.npsn}
                      onChange={(e) => set('npsn', e.target.value)}
                      placeholder="National school ID"
                    />
                    <Button type="button" variant="secondary" onClick={lookupNpsn} className="shrink-0">
                      Find
                    </Button>
                  </div>
                </Field>
                <Field label="School name">
                  <Input
                    value={form.schoolName}
                    onChange={(e) => set('schoolName', e.target.value)}
                    placeholder="Auto-fills after NPSN lookup"
                  />
                </Field>
                <Field label="Parent / guardian name">
                  <Input value={form.parentName} onChange={(e) => set('parentName', e.target.value)} />
                </Field>
                <Field label="Parent occupation">
                  <Input value={form.parentOccupation} onChange={(e) => set('parentOccupation', e.target.value)} />
                </Field>
                <Field label="Supervising teacher" wide>
                  <Input
                    value={form.supervisorName}
                    onChange={(e) => set('supervisorName', e.target.value)}
                    placeholder="Optional"
                  />
                </Field>
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save registration details'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
