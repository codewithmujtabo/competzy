'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Search, Upload } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { INTEREST_CATEGORIES } from '@/lib/constants/interests';
import type { StudentProfile } from '@/types/account';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LocationCascade } from '@/components/ui/location-cascade';

// Editable text fields. Photo + student card upload separately; email is
// read-only. Mirrors the mobile app's student profile form
// (app/app/(tabs)/profile/edit.tsx) so both surfaces capture the same data.
interface Form {
  fullName: string;
  phone: string;
  city: string;
  province: string;
  country: string | null;
  dateOfBirth: string;
  referralSource: string;
  schoolName: string;
  grade: string;
  nisn: string;
  npsn: string;
  schoolAddress: string;
  schoolEmail: string;
  schoolWhatsapp: string;
  schoolPhone: string;
  supervisorName: string;
  supervisorEmail: string;
  supervisorWhatsapp: string;
  supervisorPhone: string;
  parentName: string;
  parentOccupation: string;
  parentWhatsapp: string;
  parentPhone: string;
}

const EMPTY_FORM: Form = {
  fullName: '', phone: '', city: '', province: '', country: null, dateOfBirth: '',
  referralSource: '', schoolName: '', grade: '', nisn: '', npsn: '', schoolAddress: '',
  schoolEmail: '', schoolWhatsapp: '', schoolPhone: '', supervisorName: '',
  supervisorEmail: '', supervisorWhatsapp: '', supervisorPhone: '', parentName: '',
  parentOccupation: '', parentWhatsapp: '', parentPhone: '',
};

// Postgres DATE → an <input type="date"> value. Extract local Y/M/D so it
// round-trips the same way the mobile app's date handling does.
function toDateInputValue(v: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function Field({
  label,
  wide,
  ...props
}: { label: string; wide?: boolean } & React.ComponentProps<typeof Input>) {
  return (
    <div className={cn('space-y-1.5', wide && 'sm:col-span-2')}>
      <Label>{label}</Label>
      <Input {...props} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-4 p-6">
      <h2 className="font-serif text-lg font-medium text-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export default function AccountProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCard, setUploadingCard] = useState(false);

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [studentCardUrl, setStudentCardUrl] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [otherInterest, setOtherInterest] = useState('');

  // School-name auto-fill state, driven by the NPSN field. `npsnLookup`
  // tracks the network state of the most recent /schools/by-npsn lookup so
  // the UI can show "Looking up…" → ✓ Found / ✗ Not found inline.
  type LookupState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'found'; name: string; npsn: string }
    | { status: 'not-found'; npsn: string };
  const [npsnLookup, setNpsnLookup] = useState<LookupState>({ status: 'idle' });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    try {
      const d = await emcHttp.get<StudentProfile>('/users/me');
      setEmail(d.email);
      setPhotoUrl(d.photoUrl);
      setStudentCardUrl(d.studentCardUrl);
      setForm({
        fullName: d.fullName ?? '',
        phone: d.phone ?? '',
        city: d.city ?? '',
        province: d.province ?? '',
        country: d.country ?? null,
        dateOfBirth: toDateInputValue(d.dateOfBirth),
        referralSource: d.referralSource ?? '',
        schoolName: d.schoolName ?? '',
        grade: d.grade ?? '',
        nisn: d.nisn ?? '',
        npsn: d.npsn ?? '',
        schoolAddress: d.schoolAddress ?? '',
        schoolEmail: d.schoolEmail ?? '',
        schoolWhatsapp: d.schoolWhatsapp ?? '',
        schoolPhone: d.schoolPhone ?? '',
        supervisorName: d.supervisorName ?? '',
        supervisorEmail: d.supervisorEmail ?? '',
        supervisorWhatsapp: d.supervisorWhatsapp ?? '',
        supervisorPhone: d.supervisorPhone ?? '',
        parentName: d.parentName ?? '',
        parentOccupation: d.parentOccupation ?? '',
        parentWhatsapp: d.parentWhatsapp ?? '',
        parentPhone: d.parentPhone ?? '',
      });
      // Split the stored comma string into known categories + free text.
      const stored = (d.interests ?? '')
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const known = INTEREST_CATEGORIES as readonly string[];
      setSelectedInterests(stored.filter((i) => known.includes(i)));
      setOtherInterest(stored.filter((i) => !known.includes(i)).join(', '));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load your profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // School-name auto-fill — when NPSN looks plausibly complete, hit the
  // /schools/by-npsn endpoint. Auto-populates schoolName (and address if it's
  // empty, so we never overwrite a manual edit). Debounced 350 ms so the
  // user can finish typing.
  useEffect(() => {
    const npsn = form.npsn.trim();
    if (!/^\d{6,12}$/.test(npsn)) {
      setNpsnLookup({ status: 'idle' });
      return;
    }
    // Don't re-hit the API for an NPSN we already resolved.
    if (
      (npsnLookup.status === 'found' || npsnLookup.status === 'not-found') &&
      npsnLookup.npsn === npsn
    ) {
      return;
    }
    setNpsnLookup({ status: 'loading' });
    const timer = window.setTimeout(async () => {
      try {
        const r = await emcHttp.get<{
          name: string;
          address: string | null;
          city: string | null;
          province: string | null;
        }>(`/schools/by-npsn/${encodeURIComponent(npsn)}`);
        setNpsnLookup({ status: 'found', name: r.name, npsn });
        setForm((f) => ({
          ...f,
          schoolName: r.name,
          // Only overwrite an empty school address — never clobber a manual edit.
          schoolAddress: f.schoolAddress?.trim() ? f.schoolAddress : r.address ?? '',
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (/not found|404/i.test(msg)) setNpsnLookup({ status: 'not-found', npsn });
        else setNpsnLookup({ status: 'idle' }); // transient — silent
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [form.npsn, npsnLookup]);

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const r = await emcHttp.postFormData<{ photoUrl: string }>('/users/photo', fd);
      setPhotoUrl(r.photoUrl);
      toast.success('Profile photo updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function uploadCard(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingCard(true);
    try {
      const fd = new FormData();
      fd.append('card', file);
      const r = await emcHttp.postFormData<{ studentCardUrl: string }>(
        '/users/student-card',
        fd,
      );
      setStudentCardUrl(r.studentCardUrl);
      toast.success('Student card uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload student card');
    } finally {
      setUploadingCard(false);
    }
  }

  function toggleInterest(cat: string) {
    setSelectedInterests((cur) =>
      cur.includes(cat) ? cur.filter((i) => i !== cat) : [...cur, cat],
    );
  }

  async function handleSave() {
    if (!form.fullName.trim()) {
      toast.error('Full name is required');
      return;
    }
    setSaving(true);
    try {
      const interests = [...selectedInterests];
      if (otherInterest.trim()) interests.push(otherInterest.trim());
      await emcHttp.put<{ message: string }>('/users/me', {
        fullName: form.fullName,
        phone: form.phone,
        city: form.city,
        province: form.province,
        country: form.country,
        // A DATE column rejects '' — omit an empty value rather than clear it.
        dateOfBirth: form.dateOfBirth || undefined,
        interests: interests.join(', '),
        referralSource: form.referralSource,
        schoolName: form.schoolName,
        grade: form.grade,
        nisn: form.nisn,
        schoolAddress: form.schoolAddress,
        schoolEmail: form.schoolEmail,
        schoolWhatsapp: form.schoolWhatsapp,
        schoolPhone: form.schoolPhone,
        supervisorName: form.supervisorName,
        supervisorEmail: form.supervisorEmail,
        supervisorWhatsapp: form.supervisorWhatsapp,
        supervisorPhone: form.supervisorPhone,
        parentName: form.parentName,
        parentOccupation: form.parentOccupation,
        parentWhatsapp: form.parentWhatsapp,
        parentPhone: form.parentPhone,
      });
      toast.success('Profile saved');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initial = (form.fullName.trim()[0] || email[0] || '?').toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="My Account"
        title="Profile"
        subtitle="Your details are shared across the Competzy app and web — edit them here or in the app."
      />

      {/* Photo */}
      <Card className="gap-4 p-6">
        <h2 className="font-serif text-lg font-medium text-foreground">Profile photo</h2>
        <div className="flex items-center gap-4">
          <Avatar className="size-20">
            {photoUrl && <AvatarImage src={photoUrl} alt="" />}
            <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg"
              hidden
              onChange={uploadPhoto}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploadingPhoto}
              onClick={() => photoInputRef.current?.click()}
            >
              {uploadingPhoto ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {photoUrl ? 'Change photo' : 'Upload photo'}
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">JPG or PNG, up to 5 MB.</p>
          </div>
        </div>
      </Card>

      {/* Personal Details */}
      <Card className="gap-4 p-6">
        <h2 className="font-serif text-lg font-medium text-foreground">Personal details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            placeholder="Your full name"
          />
          <Field
            label="Date of birth"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)}
          />
          <Field
            label="WhatsApp / Phone"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="08xxx or +628xxx"
          />
          <Field label="Email" value={email} disabled />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Location</Label>
            <LocationCascade
              idCountry="profile-country"
              idProvince="profile-province"
              idCity="profile-city"
              country={form.country}
              province={form.province || null}
              city={form.city || null}
              onChange={({ country, province, city }) =>
                setForm((f) => ({
                  ...f,
                  country,
                  province: province ?? '',
                  city: city ?? '',
                }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Interests</Label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_CATEGORIES.map((cat) => {
                const on = selectedInterests.includes(cat);
                return (
                  <Button
                    key={cat}
                    type="button"
                    size="sm"
                    variant={on ? 'default' : 'outline'}
                    className="rounded-full"
                    onClick={() => toggleInterest(cat)}
                  >
                    {cat}
                  </Button>
                );
              })}
            </div>
          </div>
          <Field
            label="Other interests"
            wide
            value={otherInterest}
            onChange={(e) => setOtherInterest(e.target.value)}
            placeholder="e.g. Robotics, Gaming"
          />
          <Field
            label="How did you hear about us?"
            wide
            value={form.referralSource}
            onChange={(e) => set('referralSource', e.target.value)}
            placeholder="e.g. Social media, a friend…"
          />
        </div>
      </Card>

      {/* Student Card */}
      <Card className="gap-4 p-6">
        <h2 className="font-serif text-lg font-medium text-foreground">Student card</h2>
        {studentCardUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={studentCardUrl}
            alt="Student card"
            className="max-h-56 rounded-md border object-contain"
          />
        )}
        <div>
          <input
            ref={cardInputRef}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={uploadCard}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploadingCard}
            onClick={() => cardInputRef.current?.click()}
          >
            {uploadingCard ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {studentCardUrl ? 'Change student card' : 'Upload student card'}
          </Button>
        </div>
      </Card>

      {/* School Details */}
      <Section title="School details">
        <Field
          label="School name"
          value={form.schoolName}
          onChange={(e) => set('schoolName', e.target.value)}
          placeholder="Your school"
        />
        <Field
          label="Grade"
          value={form.grade}
          onChange={(e) => set('grade', e.target.value)}
          placeholder="e.g. 9"
        />
        <Field
          label="NISN"
          value={form.nisn}
          onChange={(e) => set('nisn', e.target.value)}
          placeholder="National Student Number"
        />
        <div className="space-y-1.5">
          <Label>NPSN</Label>
          <Input
            value={form.npsn}
            onChange={(e) => set('npsn', e.target.value.replace(/\D/g, ''))}
            placeholder="National School Number"
            inputMode="numeric"
          />
          {npsnLookup.status === 'loading' && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Search className="size-3 animate-pulse" />
              Looking up school…
            </p>
          )}
          {npsnLookup.status === 'found' && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Found: <span className="font-medium">{npsnLookup.name}</span>
            </p>
          )}
          {npsnLookup.status === 'not-found' && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              No school matches that NPSN — type the school name manually.
            </p>
          )}
        </div>
        <Field
          label="School address"
          wide
          value={form.schoolAddress}
          onChange={(e) => set('schoolAddress', e.target.value)}
        />
        <Field
          label="School email"
          type="email"
          value={form.schoolEmail}
          onChange={(e) => set('schoolEmail', e.target.value)}
        />
        <Field
          label="School WhatsApp"
          value={form.schoolWhatsapp}
          onChange={(e) => set('schoolWhatsapp', e.target.value)}
        />
        <Field
          label="School phone"
          value={form.schoolPhone}
          onChange={(e) => set('schoolPhone', e.target.value)}
        />
      </Section>

      {/* Supervisor / Teacher */}
      <Section title="Supervisor / Teacher">
        <Field
          label="Name"
          value={form.supervisorName}
          onChange={(e) => set('supervisorName', e.target.value)}
        />
        <Field
          label="Email"
          type="email"
          value={form.supervisorEmail}
          onChange={(e) => set('supervisorEmail', e.target.value)}
        />
        <Field
          label="WhatsApp"
          value={form.supervisorWhatsapp}
          onChange={(e) => set('supervisorWhatsapp', e.target.value)}
        />
        <Field
          label="Phone"
          value={form.supervisorPhone}
          onChange={(e) => set('supervisorPhone', e.target.value)}
        />
      </Section>

      {/* Parent / Guardian */}
      <Section title="Parent / Guardian">
        <Field
          label="Name"
          value={form.parentName}
          onChange={(e) => set('parentName', e.target.value)}
        />
        <Field
          label="Occupation"
          value={form.parentOccupation}
          onChange={(e) => set('parentOccupation', e.target.value)}
        />
        <Field
          label="WhatsApp"
          value={form.parentWhatsapp}
          onChange={(e) => set('parentWhatsapp', e.target.value)}
        />
        <Field
          label="Phone"
          value={form.parentPhone}
          onChange={(e) => set('parentPhone', e.target.value)}
        />
      </Section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
