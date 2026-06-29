'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n/context';
import { GradeMultiSelect } from '@/components/grade-multi-select';
import { RoundsBuilder, type RoundDraft, draftsToPayload } from '@/components/rounds-builder';
import { COMPETITION_STATUSES, compStatusLabel } from '@/lib/competitions/status';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIES = ['Science', 'Math', 'Art', 'Sports', 'Technology', 'Literature', 'Music'];

export interface CompetitionFormValues {
  name: string;
  kind: 'native' | 'affiliated';
  category: string;
  gradeLevel: string;
  organizerName: string;
  websiteUrl: string;
  registrationStatus: string;
  posterUrl: string;
  isInternational: boolean;
  detailedDescription: string;
  description: string;
  fee: number;
  quota: number;
  regOpenDate: string;
  regCloseDate: string;
  competitionDate: string;
  requiredDocs: string[];
  imageUrl: string;
  participantInstructions: string;
  postPaymentRedirectUrl: string;
  rounds: RoundDraft[];
}

const DEFAULTS: CompetitionFormValues = {
  name: '',
  kind: 'native',
  category: '',
  gradeLevel: '',
  organizerName: '',
  websiteUrl: '',
  registrationStatus: 'Coming Soon',
  posterUrl: '',
  isInternational: false,
  detailedDescription: '',
  description: '',
  fee: 0,
  quota: 100,
  regOpenDate: '',
  regCloseDate: '',
  competitionDate: '',
  requiredDocs: [],
  imageUrl: '',
  participantInstructions: '',
  postPaymentRedirectUrl: '',
  rounds: [],
};

const TEXTAREA_CLS =
  'flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 p-0">
      <div className="border-b px-5 py-3.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface CompetitionFormProps {
  initial?: Partial<CompetitionFormValues>;
  submitLabel: string;
  cancelHref: string;
  /** Build + send the payload; should throw on failure. */
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

/** The shared organizer competition form — used by both the New and Edit pages. */
export function CompetitionForm({ initial, submitLabel, cancelHref, onSubmit }: CompetitionFormProps) {
  const t = useT();
  const [form, setForm] = useState<CompetitionFormValues>({ ...DEFAULTS, ...initial });
  const [newDoc, setNewDoc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (patch: Partial<CompetitionFormValues>) => setForm((f) => ({ ...f, ...patch }));

  const addDoc = () => {
    const d = newDoc.trim();
    if (d && !form.requiredDocs.includes(d)) {
      set({ requiredDocs: [...form.requiredDocs, d] });
      setNewDoc('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.category) {
      toast.error(t('cf.toastNameCategory'));
      return;
    }
    if (form.kind === 'affiliated' && !form.postPaymentRedirectUrl.trim()) {
      toast.error(t('cf.toastAffiliatedUrl'));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name,
        kind: form.kind,
        category: form.category,
        gradeLevel: form.gradeLevel || null,
        organizerName: form.organizerName || null,
        websiteUrl: form.websiteUrl || null,
        registrationStatus: form.registrationStatus,
        posterUrl: form.posterUrl || null,
        isInternational: form.isInternational,
        detailedDescription: form.detailedDescription || null,
        description: form.description || null,
        fee: Number(form.fee),
        quota: Number(form.quota),
        regOpenDate: form.regOpenDate || null,
        regCloseDate: form.regCloseDate || null,
        competitionDate: form.competitionDate || null,
        requiredDocs: form.requiredDocs,
        imageUrl: form.imageUrl || null,
        participantInstructions: form.participantInstructions || null,
        postPaymentRedirectUrl: form.postPaymentRedirectUrl || null,
        rounds: draftsToPayload(form.rounds),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('cf.toastSaveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title={t('cf.basicInfo')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('cf.name')} required>
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={t('cf.namePlaceholder')}
            />
          </Field>
          <Field label={t('cf.category')} required>
            <Select value={form.category || undefined} onValueChange={(v) => set({ category: v })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('cf.selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('cf.organizerName')} hint={t('cf.organizerNameHint')}>
            <Input
              value={form.organizerName}
              onChange={(e) => set({ organizerName: e.target.value })}
            />
          </Field>
          <Field label={t('cf.gradeLevel')} hint={t('cf.gradeLevelHint')}>
            <GradeMultiSelect
              value={form.gradeLevel}
              onChange={(v) => set({ gradeLevel: v })}
            />
          </Field>
        </div>
      </Section>

      <Section title={t('cf.competitionType')}>
        <Field
          label={t('cf.type')}
          hint={form.kind === 'affiliated' ? t('cf.typeHintAffiliated') : t('cf.typeHintNative')}
        >
          <Select
            value={form.kind}
            onValueChange={(v) => set({ kind: v as 'native' | 'affiliated' })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="native">{t('cf.native')}</SelectItem>
              <SelectItem value="affiliated">{t('cf.affiliated')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title={t('cf.regPricing')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('cf.baseFee')} hint={t('cf.baseFeeHint')}>
            <Input
              type="number"
              value={form.fee}
              onChange={(e) => set({ fee: parseInt(e.target.value, 10) || 0 })}
            />
          </Field>
          <Field label={t('cf.quota')}>
            <Input
              type="number"
              value={form.quota}
              onChange={(e) => set({ quota: parseInt(e.target.value, 10) || 0 })}
            />
          </Field>
          <Field label={t('cf.regStatus')}>
            <Select
              value={form.registrationStatus}
              onValueChange={(v) => set({ registrationStatus: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPETITION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {compStatusLabel(s, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('cf.international')}>
            <Select
              value={form.isInternational ? 'yes' : 'no'}
              onValueChange={(v) => set({ isInternational: v === 'yes' })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">{t('cf.no')}</SelectItem>
                <SelectItem value="yes">{t('cf.yes')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title={t('cf.competitionRounds')}>
        <RoundsBuilder rounds={form.rounds} onChange={(rounds) => set({ rounds })} />
      </Section>

      <Section title={t('cf.importantDates')}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('cf.regOpens')}>
            <Input
              type="date"
              value={form.regOpenDate}
              onChange={(e) => set({ regOpenDate: e.target.value })}
            />
          </Field>
          <Field label={t('cf.regCloses')}>
            <Input
              type="date"
              value={form.regCloseDate}
              onChange={(e) => set({ regCloseDate: e.target.value })}
            />
          </Field>
          <Field label={t('cf.competitionDate')}>
            <Input
              type="date"
              value={form.competitionDate}
              onChange={(e) => set({ competitionDate: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title={t('cf.requiredDocs')}>
        <div className="flex gap-2">
          <Input
            value={newDoc}
            onChange={(e) => setNewDoc(e.target.value)}
            placeholder={t('cf.addDocPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDoc();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addDoc}>
            {t('cf.add')}
          </Button>
        </div>
        {form.requiredDocs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {form.requiredDocs.map((doc) => (
              <Badge key={doc} variant="secondary" className="gap-1 font-normal">
                {doc}
                <button
                  type="button"
                  onClick={() => set({ requiredDocs: form.requiredDocs.filter((d) => d !== doc) })}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t('cf.removeDoc', { doc })}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </Section>

      <Section title={t('cf.mediaLinks')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('cf.imageUrl')}>
            <Input
              type="url"
              value={form.imageUrl}
              onChange={(e) => set({ imageUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label={t('cf.posterUrl')}>
            <Input
              type="url"
              value={form.posterUrl}
              onChange={(e) => set({ posterUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label={t('cf.websiteUrl')} className="sm:col-span-2">
            <Input
              type="url"
              value={form.websiteUrl}
              onChange={(e) => set({ websiteUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field
            label={form.kind === 'affiliated' ? t('cf.affiliatedUrl') : t('cf.postPaymentUrl')}
            required={form.kind === 'affiliated'}
            className="sm:col-span-2"
            hint={form.kind === 'affiliated' ? t('cf.affiliatedUrlHint') : t('cf.postPaymentUrlHint')}
          >
            <Input
              type="url"
              value={form.postPaymentRedirectUrl}
              onChange={(e) => set({ postPaymentRedirectUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
        </div>
      </Section>

      <Section title={t('cf.descriptions')}>
        <div className="space-y-4">
          <Field label={t('cf.shortDesc')}>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              className={TEXTAREA_CLS}
              placeholder={t('cf.shortDescPlaceholder')}
            />
          </Field>
          <Field label={t('cf.detailedDesc')}>
            <textarea
              rows={6}
              value={form.detailedDescription}
              onChange={(e) => set({ detailedDescription: e.target.value })}
              className={TEXTAREA_CLS}
              placeholder={t('cf.detailedDescPlaceholder')}
            />
          </Field>
          <Field label={t('cf.participantInstructions')}>
            <textarea
              rows={3}
              value={form.participantInstructions}
              onChange={(e) => set({ participantInstructions: e.target.value })}
              className={TEXTAREA_CLS}
              placeholder={t('cf.participantInstructionsPlaceholder')}
            />
          </Field>
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <Link href={cancelHref}>{t('common.cancel')}</Link>
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? t('cf.saving') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
