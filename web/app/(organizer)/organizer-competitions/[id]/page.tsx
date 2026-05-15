'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Download, ExternalLink, Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import { organizerCompetitionsApi } from '@/lib/api';
import { organizerHttp } from '@/lib/api/client';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Competition {
  id: string;
  name: string;
  organizerName: string;
  category: string;
  gradeLevel: string;
  fee: number;
  quota: number;
  description: string;
  detailedDescription: string;
  regOpenDate: string;
  regCloseDate: string;
  competitionDate: string;
  registrationStatus: string;
  isInternational: boolean;
  websiteUrl: string;
  imageUrl: string;
  posterUrl: string;
  participantInstructions: string;
  requiredDocs: string[];
  registrationCount: number;
  csvTemplateUrl: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  'On Going': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  'Coming Soon': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  Closed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
};

function fmtDate(d?: string) {
  return d
    ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
}

function fmtRp(n: number) {
  return n === 0 ? 'Free' : `Rp ${n.toLocaleString('id-ID')}`;
}

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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export default function CompetitionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) ?? '';

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    organizerCompetitionsApi
      .getOne(id)
      .then(setCompetition)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load competition'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm(`Delete "${competition?.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await organizerCompetitionsApi.delete(id);
      toast.success('Competition deleted.');
      router.push('/organizer-competitions');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete competition');
      setDeleting(false);
    }
  };

  const handleTemplateUpload = async () => {
    if (!templateFile || !id) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', templateFile);
      const result = await organizerHttp.postFormData<{ csvTemplateUrl: string }>(
        `/organizers/competitions/${id}/csv-template`,
        fd,
      );
      setCompetition((prev) => (prev ? { ...prev, csvTemplateUrl: result.csvTemplateUrl } : prev));
      setTemplateFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('CSV template uploaded.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !competition) {
    return (
      <div className="mx-auto max-w-[1100px] space-y-4 p-6 lg:p-8">
        <p className="text-sm text-destructive">{error || 'Competition not found.'}</p>
        <Button asChild variant="outline">
          <Link href="/organizer-competitions">Back to competitions</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="My competitions"
        title={competition.name}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/organizer-competitions/${id}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="size-4" />
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className={cn(
            'border-transparent font-mono text-[10px]',
            STATUS_STYLE[competition.registrationStatus] ?? 'bg-muted text-muted-foreground',
          )}
        >
          {competition.registrationStatus}
        </Badge>
        <span className="text-xs text-muted-foreground">Created {fmtDate(competition.createdAt)}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Competition details">
          <dl className="grid grid-cols-2 gap-4">
            <Row label="Category" value={competition.category || '—'} />
            <Row label="Grade level" value={competition.gradeLevel || '—'} />
            <Row label="Organizer" value={competition.organizerName || '—'} />
            <Row label="International" value={competition.isInternational ? 'Yes' : 'No'} />
          </dl>
        </Section>

        <Section title="Pricing & quota">
          <dl className="grid grid-cols-3 gap-4">
            <Row label="Fee" value={<span className="font-semibold">{fmtRp(competition.fee)}</span>} />
            <Row label="Quota" value={competition.quota ? `${competition.quota}` : 'Unlimited'} />
            <Row
              label="Registrations"
              value={<span className="font-semibold">{competition.registrationCount || 0}</span>}
            />
          </dl>
        </Section>
      </div>

      <Section title="Important dates">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Row label="Registration opens" value={fmtDate(competition.regOpenDate)} />
          <Row label="Registration closes" value={fmtDate(competition.regCloseDate)} />
          <Row label="Competition date" value={fmtDate(competition.competitionDate)} />
        </dl>
      </Section>

      {(competition.description || competition.detailedDescription) && (
        <Section title="Description">
          <div className="space-y-4">
            {competition.description && (
              <Row
                label="Short description"
                value={<span className="whitespace-pre-wrap">{competition.description}</span>}
              />
            )}
            {competition.detailedDescription && (
              <Row
                label="Detailed description"
                value={<span className="whitespace-pre-wrap">{competition.detailedDescription}</span>}
              />
            )}
          </div>
        </Section>
      )}

      {competition.requiredDocs?.length > 0 && (
        <Section title="Required documents">
          <div className="flex flex-wrap gap-2">
            {competition.requiredDocs.map((doc, i) => (
              <Badge key={i} variant="secondary" className="font-normal">
                {doc}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {(competition.imageUrl || competition.posterUrl || competition.websiteUrl) && (
        <Section title="Media & links">
          <div className="flex flex-col gap-2">
            {competition.imageUrl && (
              <a
                href={competition.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Thumbnail image <ExternalLink className="size-3.5" />
              </a>
            )}
            {competition.posterUrl && (
              <a
                href={competition.posterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Poster <ExternalLink className="size-3.5" />
              </a>
            )}
            {competition.websiteUrl && (
              <a
                href={competition.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Official website <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </Section>
      )}

      {competition.participantInstructions && (
        <Section title="Participant instructions">
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {competition.participantInstructions}
          </p>
        </Section>
      )}

      <Section title="CSV template for bulk registration">
        <p className="mb-4 text-sm text-muted-foreground">
          Upload a sample CSV showing teachers the columns and format to use when bulk-registering
          students for this competition.
        </p>

        {competition.csvTemplateUrl ? (
          <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
            <Download className="size-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Template uploaded</p>
              <p className="text-xs text-muted-foreground">
                Teachers can download this to see the expected format.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <a href={competition.csvTemplateUrl} download>
                Download
              </a>
            </Button>
          </div>
        ) : (
          <div className="mb-4 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            No template uploaded. Teachers use the standard format:{' '}
            <code className="rounded bg-background px-1 py-0.5 font-mono">
              full_name, email, nisn, grade, school_name, phone
            </code>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
            className="flex-1 text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
          />
          <Button onClick={handleTemplateUpload} disabled={!templateFile || uploading}>
            <Upload className="size-4" />
            {uploading ? 'Uploading…' : competition.csvTemplateUrl ? 'Replace' : 'Upload'}
          </Button>
        </div>
      </Section>
    </div>
  );
}
