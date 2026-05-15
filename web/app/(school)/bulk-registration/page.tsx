'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, Download, FileText, Loader2, Upload, X } from 'lucide-react';
import { schoolHttp, schoolFetch, useSchool } from '@/lib/auth/school-context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Competition {
  id: string;
  name: string;
  category?: string;
  fee: number;
  csvTemplateUrl?: string | null;
}
type CsvRow = Record<string, string>;
interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  errors: { row: number; error: string }[];
  progress: number;
}

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.trim().split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const splitLine = (l: string) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])) as CsvRow;
  });
  return { headers, rows };
}

function buildUploadCsv(rows: CsvRow[], competitionId: string): File {
  const headers = [...Object.keys(rows[0]).filter((h) => h !== 'competition_id'), 'competition_id'];
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => (h === 'competition_id' ? competitionId : r[h] ?? '')).join(',')),
  ];
  return new File([lines.join('\n')], 'bulk-registration.csv', { type: 'text/csv' });
}

const rowHasIssue = (row: CsvRow) => !row['full_name']?.trim() || !row['email']?.trim();

const STEPS = ['Select competition', 'Upload & preview', 'Processing', 'Results'];

export default function BulkRegistrationPage() {
  const { user, loading: authLoading } = useSchool();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      schoolHttp
        .get<Competition[]>('/competitions?registration_status=Open&limit=100')
        .then((data) => setCompetitions(Array.isArray(data) ? data : []))
        .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load competitions'));
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!jobStatus?.id || jobStatus.status === 'completed' || jobStatus.status === 'failed') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        setJobStatus(await schoolHttp.get<JobStatus>(`/bulk-registration/jobs/${jobStatus.id}`));
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobStatus?.id, jobStatus?.status]);

  if (authLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || (user.role !== 'school_admin' && user.role !== 'teacher')) {
    return (
      <div className="mx-auto max-w-[900px] p-6 lg:p-8">
        <Card className="p-12 text-center">
          <p className="text-sm text-destructive">
            Access denied — a school-admin or teacher account is required.
          </p>
          <Button asChild className="mt-4">
            <Link href="/school-dashboard">Back to dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const handleSelectComp = async (comp: Competition) => {
    setSelectedComp(comp);
    if (comp.csvTemplateUrl === undefined) {
      setLoadingTemplate(true);
      try {
        const detail = await schoolHttp.get<{ csv_template_url?: string; csvTemplateUrl?: string }>(
          `/competitions/${comp.id}`,
        );
        setSelectedComp({ ...comp, csvTemplateUrl: detail.csvTemplateUrl ?? detail.csv_template_url ?? null });
      } catch {
        /* non-critical */
      } finally {
        setLoadingTemplate(false);
      }
    }
  };

  const handleFileSelect = (file: File | null) => {
    setCsvFile(file);
    setCsvRows([]);
    setCsvHeaders([]);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCsv((e.target?.result as string) ?? '');
      setCsvHeaders(headers);
      setCsvRows(rows);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!selectedComp || csvRows.length === 0) return;
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('file', buildUploadCsv(csvRows, selectedComp.id));
      const res = await schoolFetch('/bulk-registration/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Upload failed');
      setJobStatus({
        id: data.jobId,
        status: 'pending',
        totalRows: csvRows.length,
        processedRows: 0,
        successfulRows: 0,
        failedRows: 0,
        errors: [],
        progress: 0,
      });
      setStep(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const issueCount = csvRows.filter(rowHasIssue).length;
  const errorRowNums = new Set(jobStatus?.errors.map((e) => e.row) ?? []);

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="School"
        title="Bulk Registration"
        subtitle="Register many students for a competition from a single CSV file."
      />

      {/* Step indicator */}
      <ol className="flex items-center">
        {STEPS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4;
          const active = step === n;
          const done = step > n;
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  done || active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-xs',
                  active ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
              {i < 3 && <span className={cn('mx-2 h-px flex-1', done ? 'bg-primary' : 'bg-border')} />}
            </li>
          );
        })}
      </ol>

      {/* Step 1 — select competition */}
      {step === 1 && (
        <Card className="gap-4 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Choose a competition
          </p>
          {competitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open competitions available.</p>
          ) : (
            <div className="space-y-2">
              {competitions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectComp(c)}
                  className={cn(
                    'w-full rounded-lg border px-4 py-3 text-left transition-colors',
                    selectedComp?.id === c.id
                      ? 'border-primary bg-accent'
                      : 'hover:border-primary/40 hover:bg-muted',
                  )}
                >
                  <div className="text-sm font-medium text-foreground">{c.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {c.category ? `${c.category} · ` : ''}
                    {c.fee === 0 ? 'Free' : `Rp ${c.fee.toLocaleString('id-ID')} / student`}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedComp && (
            <div className="rounded-lg border bg-muted/40 p-4">
              {loadingTemplate ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading template info…
                </p>
              ) : selectedComp.csvTemplateUrl ? (
                <>
                  <p className="text-sm font-medium text-foreground">CSV template available</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The organizer provided a sample CSV for this competition. Download it, fill in
                    your students, and upload it in the next step.
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <a href={selectedComp.csvTemplateUrl} download>
                      <Download className="size-3.5" />
                      Download template
                    </a>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">No template for this competition</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use the standard format — required: <code className="font-mono">full_name</code>,{' '}
                    <code className="font-mono">email</code>; optional:{' '}
                    <code className="font-mono">nisn, grade, school_name, phone</code>.
                  </p>
                </>
              )}
            </div>
          )}

          <div>
            <Button onClick={() => setStep(2)} disabled={!selectedComp}>
              Continue to upload
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2 — upload & preview */}
      {step === 2 && (
        <Card className="gap-4 p-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Competition
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{selectedComp?.name}</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          />
          <div
            className={cn(
              'rounded-lg border-2 border-dashed p-8 text-center',
              csvFile ? 'border-primary/40 bg-accent/40' : 'bg-muted/40',
            )}
          >
            {csvFile ? (
              <>
                <p className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
                  <FileText className="size-4" /> {csvFile.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{csvRows.length} rows detected</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => {
                    handleFileSelect(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X className="size-3.5" />
                  Remove
                </Button>
              </>
            ) : (
              <>
                <Upload className="mx-auto size-7 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Upload your CSV file</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                  Browse file
                </Button>
              </>
            )}
          </div>

          {csvRows.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Preview — {csvRows.length} students
                </p>
                {issueCount > 0 && (
                  <Badge
                    variant="outline"
                    className="border-transparent bg-amber-100 font-mono text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  >
                    {issueCount} row{issueCount > 1 ? 's' : ''} missing full_name / email
                  </Badge>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      {csvHeaders.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap">
                          {h}
                          {(h === 'full_name' || h === 'email') && (
                            <span className="text-destructive"> *</span>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvRows.slice(0, 50).map((row, i) => {
                      const issue = rowHasIssue(row);
                      return (
                        <TableRow key={i} className={cn(issue && 'bg-amber-50 dark:bg-amber-950/30')}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                          {csvHeaders.map((h) => (
                            <TableCell key={h} className="max-w-[200px] truncate">
                              {row[h] || <span className="italic text-muted-foreground">empty</span>}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {csvRows.length > 50 && (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                    Showing the first 50 of {csvRows.length} rows. All will be submitted.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={csvRows.length === 0 || submitting}>
              {submitting ? 'Submitting…' : `Register ${csvRows.length} student${csvRows.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3 — processing */}
      {step === 3 && jobStatus && (
        <Card className="gap-4 p-5">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {jobStatus.status === 'completed'
                  ? 'Complete'
                  : jobStatus.status === 'failed'
                    ? 'Failed'
                    : jobStatus.status === 'processing'
                      ? 'Processing…'
                      : 'Queued — waiting for the processor…'}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {jobStatus.processedRows}/{jobStatus.totalRows}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  jobStatus.status === 'completed' ? 'bg-chart-5' : 'bg-primary',
                )}
                style={{
                  width: `${jobStatus.progress ?? (jobStatus.totalRows > 0 ? (jobStatus.processedRows / jobStatus.totalRows) * 100 : 0)}%`,
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-emerald-50 p-4 text-center dark:bg-emerald-950/40">
              <div className="font-serif text-2xl font-medium text-emerald-700 dark:text-emerald-300">
                {jobStatus.successfulRows}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Registered</div>
            </div>
            <div className="rounded-lg border bg-red-50 p-4 text-center dark:bg-red-950/40">
              <div className="font-serif text-2xl font-medium text-red-700 dark:text-red-300">
                {jobStatus.failedRows}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Failed</div>
            </div>
          </div>

          {(jobStatus.status === 'pending' || jobStatus.status === 'processing') && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Processing registrations…
            </p>
          )}
          {(jobStatus.status === 'completed' || jobStatus.status === 'failed') && (
            <div>
              <Button onClick={() => setStep(4)}>View results</Button>
            </div>
          )}
        </Card>
      )}

      {/* Step 4 — results */}
      {step === 4 && jobStatus && (
        <Card className="gap-4 p-5">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Results — {selectedComp?.name}
            </p>
            <div className="flex gap-3 text-sm">
              <span className="text-emerald-600 dark:text-emerald-400">{jobStatus.successfulRows} ok</span>
              {jobStatus.failedRows > 0 && (
                <span className="text-destructive">{jobStatus.failedRows} failed</span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvRows.map((row, i) => {
                  const err = jobStatus.errors.find((e) => e.row === i + 1);
                  const failed = errorRowNums.has(i + 1);
                  return (
                    <TableRow key={i} className={cn(failed && 'bg-red-50 dark:bg-red-950/30')}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-foreground">{row['full_name'] || '—'}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {row['email'] || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'border-transparent font-mono text-[10px]',
                            failed
                              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
                          )}
                        >
                          {failed ? 'Failed' : 'Registered'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {err ? err.error : 'Registered successfully'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/school-registrations">View all registrations</Link>
            </Button>
            {(selectedComp?.fee ?? 0) > 0 && jobStatus.successfulRows > 0 && (
              <Button asChild>
                <Link href={`/bulk-payment?competitionId=${selectedComp?.id}`}>
                  Pay for registered students
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setStep(1);
                setSelectedComp(null);
                handleFileSelect(null);
                setJobStatus(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              New bulk registration
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
