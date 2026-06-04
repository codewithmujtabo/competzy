'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import type { MessageKey } from '@/lib/i18n/messages/en';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  labelKey: MessageKey;
  type?: 'text' | 'email' | 'date' | 'tel' | 'grade';
  placeholder?: string;
  wide?: boolean;
}

const FIELDS: Record<ProfileFieldKey, FieldDef> = {
  fullName:           { key: 'fullName',           labelKey: 'pf.fullName', wide: true },
  email:              { key: 'email',              labelKey: 'pf.email', type: 'email' },
  phone:              { key: 'phone',              labelKey: 'pf.phone', type: 'tel', placeholder: '08xxx or +628xxx' },
  city:               { key: 'city',               labelKey: 'pf.city' },
  province:           { key: 'province',           labelKey: 'pf.province' },
  country:            { key: 'country',            labelKey: 'pf.country' },
  dateOfBirth:        { key: 'dateOfBirth',        labelKey: 'pf.dateOfBirth', type: 'date' },
  supervisorName:     { key: 'supervisorName',     labelKey: 'pf.supervisorName' },
  supervisorEmail:    { key: 'supervisorEmail',    labelKey: 'pf.supervisorEmail', type: 'email' },
  supervisorWhatsapp: { key: 'supervisorWhatsapp', labelKey: 'pf.supervisorWhatsapp', type: 'tel' },
  supervisorPhone:    { key: 'supervisorPhone',    labelKey: 'pf.supervisorPhone', type: 'tel' },
  schoolName:         { key: 'schoolName',         labelKey: 'pf.schoolName', wide: true },
  schoolEmail:        { key: 'schoolEmail',        labelKey: 'pf.schoolEmail', type: 'email' },
  schoolAddress:      { key: 'schoolAddress',      labelKey: 'pf.schoolAddress', wide: true },
  schoolWhatsapp:     { key: 'schoolWhatsapp',     labelKey: 'pf.schoolWhatsapp', type: 'tel' },
  schoolPhone:        { key: 'schoolPhone',        labelKey: 'pf.schoolPhone', type: 'tel' },
  parentName:         { key: 'parentName',         labelKey: 'pf.parentName', wide: true },
  parentWhatsapp:     { key: 'parentWhatsapp',     labelKey: 'pf.parentWhatsapp', type: 'tel' },
  parentPhone:        { key: 'parentPhone',        labelKey: 'pf.parentPhone', type: 'tel' },
  grade:              { key: 'grade',              labelKey: 'pf.grade', type: 'grade' },
  nisn:               { key: 'nisn',               labelKey: 'pf.nisn', placeholder: 'National Student Number' },
  npsn:               { key: 'npsn',               labelKey: 'pf.npsn', placeholder: 'National School Number' },
};

// Always-rendered field order, applied to both the Required and Optional
// sections — the canonical "Confirm your details" layout the operator asked
// for. The dialog walks this list once for required, once for optional.
const FIELD_ORDER: ProfileFieldKey[] = [
  'fullName',
  'email',
  'phone',
  'dateOfBirth',
  'schoolName',
  'country',
  'province',
  'city',
  'supervisorName',
  'supervisorEmail',
];

// Fields that always render as OPTIONAL, even when the competition's
// `required_profile_fields` doesn't list them. Province + city + teacher
// info should always be editable from this dialog because the student may
// want to update them at registration time.
const ALWAYS_OPTIONAL: ProfileFieldKey[] = [
  'province',
  'city',
  'supervisorName',
  'supervisorEmail',
];

interface Props {
  /** True when the dialog should be visible. */
  open: boolean;
  /** Called whenever the dialog wants to close (cancel button, Esc, overlay click). */
  onCancel: () => void;
  /** Field keys the user is missing — these become the Required section. */
  missingFields: ProfileFieldKey[];
  /** Called after the missing fields are saved successfully — the caller retries the registration. */
  onCompleted: () => void;
  /** Optional context — e.g. "Komodo Online Round 1". Shown in the description. */
  contextLabel?: string;
}

/**
 * Two-section profile completion dialog. The Required section above gates
 * Save (it's what the server returned as 409 PROFILE_INCOMPLETE); the
 * Optional section below carries fields the student can fill at their own
 * pace (province / city / teacher info). Province + city are always rendered
 * here as a top-up channel — the registration form itself only asks Country.
 */
export function ProfileCompletionDialog({
  open,
  onCancel,
  missingFields,
  onCompleted,
  contextLabel,
}: Props) {
  const t = useT();
  const [values, setValues] = useState<Record<string, string>>({});
  const [country, setCountry] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Split the rendered field list into Required (in missingFields) +
  // Optional (everything else from FIELD_ORDER that should always show).
  const { required, optional } = useMemo(() => {
    const reqSet = new Set(missingFields);
    const requiredKeys = FIELD_ORDER.filter((k) => reqSet.has(k));
    const optionalKeys = FIELD_ORDER.filter(
      (k) => !reqSet.has(k) && ALWAYS_OPTIONAL.includes(k),
    );
    return { required: requiredKeys, optional: optionalKeys };
  }, [missingFields]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setValues({});
    setCountry(null);
    (async () => {
      try {
        const me = await emcHttp.get<Record<string, string | null>>('/users/me');
        if (cancelled) return;
        setCountry(typeof me.country === 'string' ? me.country : null);
        const next: Record<string, string> = {};
        for (const k of FIELD_ORDER) {
          if (k === 'country') continue; // separate state
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
        // Pre-fill is best-effort.
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  function set(k: ProfileFieldKey, v: string) {
    setValues((cur) => ({ ...cur, [k]: v }));
  }

  // Save is gated only on the REQUIRED fields. Optional ones can stay blank.
  const canSave =
    !saving &&
    required.every((k) => {
      if (k === 'country') return !!country;
      return !!(values[k] || '').trim();
    });

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, string | null | undefined> = {};
      // Walk both groups — anything the user typed gets sent. Empty strings
      // clear the column (PUT /users/me treats '' as a delete).
      for (const k of [...required, ...optional]) {
        if (k === 'country') {
          payload.country = country;
          continue;
        }
        const f = FIELDS[k];
        if (f.type === 'date') {
          // A DATE column rejects '' — omit empty rather than clear.
          payload[k] = (values[k] || '').trim() || undefined;
        } else {
          payload[k] = (values[k] || '').trim();
        }
      }
      await emcHttp.put<{ message: string }>('/users/me', payload);
      toast.success(t('profileDlg.toastSaved'));
      onCompleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('profileDlg.toastFailed'));
    } finally {
      setSaving(false);
    }
  }

  function renderField(k: ProfileFieldKey) {
    const f = FIELDS[k];
    if (k === 'country') {
      return (
        <div key={k} className={f.wide ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}>
          <Label htmlFor={`pcd-${k}`}>{t(f.labelKey)}</Label>
          <CountrySelect id={`pcd-${k}`} value={country} onChange={setCountry} />
        </div>
      );
    }
    if (f.type === 'grade') {
      return (
        <div key={k} className={f.wide ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}>
          <Label htmlFor={`pcd-${k}`}>{t(f.labelKey)}</Label>
          <Select value={values[k] || ''} onValueChange={(v) => set(k, v)}>
            <SelectTrigger id={`pcd-${k}`} className="w-full">
              <SelectValue placeholder={t('profileDlg.pickGrade')} />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                <SelectItem key={g} value={String(g)}>{t('dashboard.heroGrade', { n: g })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    return (
      <div key={k} className={f.wide ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}>
        <Label htmlFor={`pcd-${k}`}>{t(f.labelKey)}</Label>
        <Input
          id={`pcd-${k}`}
          type={f.type ?? 'text'}
          placeholder={f.placeholder}
          value={values[k] ?? ''}
          onChange={(e) => set(k, e.target.value)}
        />
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('profileDlg.title')}</DialogTitle>
          <DialogDescription>
            {contextLabel
              ? t('profileDlg.descContext', { context: contextLabel })
              : t('profileDlg.desc')}
          </DialogDescription>
        </DialogHeader>

        {required.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              {t('profileDlg.required')}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">{required.map(renderField)}</div>
          </section>
        )}

        {optional.length > 0 && (
          <section className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t('profileDlg.optional')}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">{optional.map(renderField)}</div>
          </section>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t('profileDlg.continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
