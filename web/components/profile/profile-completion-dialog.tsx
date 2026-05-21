'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CountrySelect } from '@/components/ui/country-select';
import { RegionSelect } from '@/components/ui/region-select';

/**
 * Field keys the dialog can prompt for. Must match the keys returned in the
 * `missingFields` array of a `409 PROFILE_INCOMPLETE` response and the JSON
 * keys understood by `PUT /api/users/me`.
 */
export type ProfileFieldKey =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'city'
  | 'province'
  | 'country'
  | 'dateOfBirth'
  | 'supervisorName'
  | 'supervisorEmail'
  | 'supervisorWhatsapp'
  | 'supervisorPhone'
  | 'schoolName'
  | 'schoolEmail'
  | 'schoolAddress'
  | 'schoolWhatsapp'
  | 'schoolPhone'
  | 'parentName'
  | 'parentWhatsapp'
  | 'parentPhone'
  | 'grade'
  | 'nisn'
  | 'npsn';

interface FieldDef {
  key: ProfileFieldKey;
  label: string;
  type?: 'text' | 'email' | 'date' | 'tel' | 'country' | 'region';
  placeholder?: string;
  wide?: boolean;
}

const FIELDS: Record<ProfileFieldKey, FieldDef> = {
  fullName:           { key: 'fullName',           label: 'Full name', placeholder: 'Your full name', wide: true },
  email:              { key: 'email',              label: 'Email', type: 'email' },
  phone:              { key: 'phone',              label: 'WhatsApp / Phone', type: 'tel', placeholder: '08xxx or +628xxx' },
  city:               { key: 'city',               label: 'Province & city', type: 'region', wide: true },
  province:           { key: 'province',           label: 'Province', placeholder: 'Your province' },
  country:            { key: 'country',            label: 'Country', type: 'country' },
  dateOfBirth:        { key: 'dateOfBirth',        label: 'Date of birth', type: 'date' },
  supervisorName:     { key: 'supervisorName',     label: 'Teacher / Supervisor name', wide: true },
  supervisorEmail:    { key: 'supervisorEmail',    label: 'Teacher / Supervisor email', type: 'email' },
  supervisorWhatsapp: { key: 'supervisorWhatsapp', label: 'Teacher / Supervisor WhatsApp', type: 'tel' },
  supervisorPhone:    { key: 'supervisorPhone',    label: 'Teacher / Supervisor phone', type: 'tel' },
  schoolName:         { key: 'schoolName',         label: 'School name', wide: true },
  schoolEmail:        { key: 'schoolEmail',        label: 'School email', type: 'email' },
  schoolAddress:      { key: 'schoolAddress',      label: 'School address', wide: true },
  schoolWhatsapp:     { key: 'schoolWhatsapp',     label: 'School WhatsApp', type: 'tel' },
  schoolPhone:        { key: 'schoolPhone',        label: 'School phone', type: 'tel' },
  parentName:         { key: 'parentName',         label: 'Parent name', wide: true },
  parentWhatsapp:     { key: 'parentWhatsapp',     label: 'Parent WhatsApp', type: 'tel' },
  parentPhone:        { key: 'parentPhone',        label: 'Parent phone', type: 'tel' },
  grade:              { key: 'grade',              label: 'Grade', placeholder: 'e.g. 9' },
  nisn:               { key: 'nisn',               label: 'NISN', placeholder: 'National Student Number' },
  npsn:               { key: 'npsn',               label: 'NPSN', placeholder: 'National School Number' },
};

interface Props {
  /** True when the dialog should be visible. */
  open: boolean;
  /** Called whenever the dialog wants to close (cancel button, Esc, overlay click). */
  onCancel: () => void;
  /** Field keys the user is missing. The dialog renders only these. */
  missingFields: ProfileFieldKey[];
  /** Called after the missing fields are saved successfully — the caller retries the registration. */
  onCompleted: () => void;
  /** Optional context — e.g. "Komodo Online Round 1". Shown in the description. */
  contextLabel?: string;
}

/**
 * Dialog that prompts the student to fill any missing mandatory profile fields
 * before a competition registration can proceed. Driven entirely by the
 * `missingFields` array — renders one input per key. On submit it PUTs the
 * filled values to `/users/me` and signals success via `onCompleted` so the
 * caller can retry the registration POST.
 *
 * Fetches `GET /users/me` on open to pre-fill anything the user has typed
 * partially (e.g. they have an email but no country yet — the email input
 * starts populated).
 */
export function ProfileCompletionDialog({
  open,
  onCancel,
  missingFields,
  onCompleted,
  contextLabel,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [country, setCountry] = useState<string | null>(null);
  // Region (province + city) is captured together via the cascading picker.
  // Even when only `city` is in missingFields we keep both so we can persist
  // the province too — the server stores them as plain TEXT.
  const [region, setRegion] = useState<{ province: string | null; city: string | null }>({
    province: null,
    city: null,
  });
  const [saving, setSaving] = useState(false);

  // De-duplicate so that requesting both `city` and `province` doesn't render
  // the cascading picker twice — the city field already handles both.
  const renderedKeys = useMemo(() => {
    const out: ProfileFieldKey[] = [];
    const seenRegion = { current: false };
    for (const k of missingFields) {
      if (k === 'city' || k === 'province') {
        if (seenRegion.current) continue;
        seenRegion.current = true;
        out.push('city');
        continue;
      }
      out.push(k);
    }
    return out;
  }, [missingFields]);

  const fields = useMemo(
    () => renderedKeys.map((k) => FIELDS[k]).filter(Boolean),
    [renderedKeys],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setValues({});
    setCountry(null);
    setRegion({ province: null, city: null });
    // Pre-fill with whatever the user already has so they only fill the gaps.
    (async () => {
      try {
        const me = await emcHttp.get<Record<string, string | null>>('/users/me');
        if (cancelled) return;
        const next: Record<string, string> = {};
        // Always read province + city together — even if only one is in the
        // missing set, the picker shows both columns so we should pre-fill
        // whatever exists.
        setRegion({
          province: typeof me.province === 'string' ? me.province : null,
          city: typeof me.city === 'string' ? me.city : null,
        });
        for (const k of renderedKeys) {
          if (k === 'country') {
            setCountry(typeof me.country === 'string' ? me.country : null);
            continue;
          }
          if (k === 'city' || k === 'province') continue; // handled by region state
          const raw = me[k];
          if (k === 'dateOfBirth' && raw) {
            const d = new Date(raw);
            if (!Number.isNaN(d.getTime())) {
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              next[k] = `${d.getFullYear()}-${m}-${day}`;
              continue;
            }
          }
          next[k] = typeof raw === 'string' ? raw : '';
        }
        setValues(next);
      } catch {
        // Pre-fill is best-effort; the user can still type into empty fields.
      }
    })();
    return () => { cancelled = true; };
  }, [open, missingFields, renderedKeys]);

  function set(k: ProfileFieldKey, v: string) {
    setValues((cur) => ({ ...cur, [k]: v }));
  }

  // The dialog only allows Save when every prompted field carries a value —
  // they're all mandatory, by definition (this dialog only shows because the
  // server already returned them as missing).
  const canSave =
    !saving &&
    fields.every((f) => {
      if (f.type === 'country') return !!country;
      if (f.type === 'region') {
        // Require both province and city when the region picker is shown.
        return !!region.province?.trim() && !!region.city?.trim();
      }
      return !!(values[f.key] || '').trim();
    });

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, string | null | undefined> = {};
      for (const f of fields) {
        if (f.type === 'country') {
          payload.country = country;
        } else if (f.type === 'region') {
          payload.province = (region.province || '').trim() || null;
          payload.city = (region.city || '').trim() || null;
        } else if (f.type === 'date') {
          // A DATE column rejects '' — omit empty rather than clear it.
          payload[f.key] = (values[f.key] || '').trim() || undefined;
        } else {
          payload[f.key] = (values[f.key] || '').trim();
        }
      }
      await emcHttp.put<{ message: string }>('/users/me', payload);
      toast.success('Details confirmed — continuing to registration');
      onCompleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save your details');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Confirm your details</DialogTitle>
          <DialogDescription>
            {contextLabel ? (
              <>Review the details below for <span className="font-medium text-foreground">{contextLabel}</span>. We&apos;ve pre-filled everything from your profile — edit anything that needs fixing, then continue to payment.</>
            ) : (
              <>Review the details below before registering. We&apos;ve pre-filled everything from your profile — edit anything that needs fixing, then continue to payment.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.wide ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}>
              <Label htmlFor={`pcd-${f.key}`}>{f.label}</Label>
              {f.type === 'country' ? (
                <CountrySelect id={`pcd-${f.key}`} value={country} onChange={setCountry} />
              ) : f.type === 'region' ? (
                <RegionSelect
                  idProvince={`pcd-${f.key}-province`}
                  idCity={`pcd-${f.key}-city`}
                  province={region.province}
                  city={region.city}
                  onChange={setRegion}
                />
              ) : (
                <Input
                  id={`pcd-${f.key}`}
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Confirm and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
