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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIES = ['Science', 'Math', 'Art', 'Sports', 'Technology', 'Literature', 'Music'];
const GRADE_LEVELS = ['SD', 'SMP', 'SMA', 'Umum'];
const STATUSES = ['Coming Soon', 'On Going', 'Closed'];

export interface CompetitionFormValues {
  name: string;
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
}

const DEFAULTS: CompetitionFormValues = {
  name: '',
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
      toast.error('Competition name and category are required');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name,
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
        rounds: [],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save competition');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Basic information">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Competition name" required>
            <Input
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. National Science Olympiad"
            />
          </Field>
          <Field label="Category" required>
            <Select value={form.category || undefined} onValueChange={(v) => set({ category: v })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category" />
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
          <Field label="Organizer name" hint="Uses your profile name if left empty">
            <Input
              value={form.organizerName}
              onChange={(e) => set({ organizerName: e.target.value })}
            />
          </Field>
          <Field label="Grade level">
            <Select value={form.gradeLevel || undefined} onValueChange={(v) => set({ gradeLevel: v })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select grade level" />
              </SelectTrigger>
              <SelectContent>
                {GRADE_LEVELS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Registration & pricing">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Registration fee (IDR)" hint="0 for a free competition">
            <Input
              type="number"
              value={form.fee}
              onChange={(e) => set({ fee: parseInt(e.target.value, 10) || 0 })}
            />
          </Field>
          <Field label="Quota">
            <Input
              type="number"
              value={form.quota}
              onChange={(e) => set({ quota: parseInt(e.target.value, 10) || 0 })}
            />
          </Field>
          <Field label="Registration status">
            <Select
              value={form.registrationStatus}
              onValueChange={(v) => set({ registrationStatus: v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="International competition">
            <Select
              value={form.isInternational ? 'yes' : 'no'}
              onValueChange={(v) => set({ isInternational: v === 'yes' })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Important dates">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Registration opens">
            <Input
              type="date"
              value={form.regOpenDate}
              onChange={(e) => set({ regOpenDate: e.target.value })}
            />
          </Field>
          <Field label="Registration closes">
            <Input
              type="date"
              value={form.regCloseDate}
              onChange={(e) => set({ regCloseDate: e.target.value })}
            />
          </Field>
          <Field label="Competition date">
            <Input
              type="date"
              value={form.competitionDate}
              onChange={(e) => set({ competitionDate: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Required documents">
        <div className="flex gap-2">
          <Input
            value={newDoc}
            onChange={(e) => setNewDoc(e.target.value)}
            placeholder="e.g. Student ID, Recommendation Letter"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDoc();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addDoc}>
            Add
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
                  aria-label={`Remove ${doc}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </Section>

      <Section title="Media & links">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Image URL (thumbnail)">
            <Input
              type="url"
              value={form.imageUrl}
              onChange={(e) => set({ imageUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label="Poster URL">
            <Input
              type="url"
              value={form.posterUrl}
              onChange={(e) => set({ posterUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field label="Website URL" className="sm:col-span-2">
            <Input
              type="url"
              value={form.websiteUrl}
              onChange={(e) => set({ websiteUrl: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <Field
            label="Post-payment redirect URL"
            className="sm:col-span-2"
            hint="After payment, students are redirected here with a JWT to take the exam on your existing platform. Leave empty for the native exam (Launch 2)."
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

      <Section title="Descriptions">
        <div className="space-y-4">
          <Field label="Short description">
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              className={TEXTAREA_CLS}
              placeholder="Brief description of the competition…"
            />
          </Field>
          <Field label="Detailed description">
            <textarea
              rows={6}
              value={form.detailedDescription}
              onChange={(e) => set({ detailedDescription: e.target.value })}
              className={TEXTAREA_CLS}
              placeholder="Full description, rules, prizes…"
            />
          </Field>
          <Field label="Participant instructions">
            <textarea
              rows={3}
              value={form.participantInstructions}
              onChange={(e) => set({ participantInstructions: e.target.value })}
              className={TEXTAREA_CLS}
              placeholder="Special instructions for participants…"
            />
          </Field>
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
