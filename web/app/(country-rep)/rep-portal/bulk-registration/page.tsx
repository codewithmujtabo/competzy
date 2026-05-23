'use client';

import Link from 'next/link';
import { useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Upload, X } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { countryRepHttp } from '@/lib/api/client';
import { rupiah, useRepContext } from '@/hooks/use-rep-context';
import {
  ManualEntryGrid,
  isValidRow,
  isRowEmpty,
  type ManualRow,
} from '@/components/bulk/manual-entry-grid';

interface RepRegisterPayload {
  fullName: string;
  email: string;
  grade?: string;
}

interface RepRegisterResult {
  created: number;
  registered: number;
  skipped: number;
}

type CsvRow = Record<string, string>;

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.trim().split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const splitLine = (l: string) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])) as CsvRow;
  });
  return { headers, rows };
}

const rowHasIssue = (row: CsvRow) =>
  !(row['fullname'] || row['name'] || row['full name'] || row['full_name'])?.trim()
  || !row['email']?.trim();

function csvRowToPayload(row: CsvRow): RepRegisterPayload {
  return {
    fullName: (row['fullname'] || row['name'] || row['full name'] || row['full_name'] || '').trim(),
    email: (row['email'] || '').trim().toLowerCase(),
    grade: (row['grade'] || '').trim() || undefined,
  };
}

export default function RepBulkRegistrationPage() {
  const { ctx, loading, refresh } = useRepContext();
  const round = ctx?.localRound;

  const [mode, setMode] = useState<'csv' | 'manual'>('manual');

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual state — start with 10 empty rows so the grid looks inviting.
  // Column shape mirrors the shared ManualRow type (includes the country +
  // teacher fields Komodo international students need at registration time).
  const [manualRows, setManualRows] = useState<ManualRow[]>(() =>
    Array.from({ length: 10 }, () => ({
      fullName: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      schoolName: '',
      country: '',
      province: '',
      city: '',
      supervisorName: '',
      supervisorEmail: '',
      nisn: '',
      grade: '',
    })),
  );

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RepRegisterResult | null>(null);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setCsvFile(file);
    setCsvHeaders([]);
    setCsvRows([]);
    setResult(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { headers, rows } = parseCsv(String(reader.result ?? ''));
      setCsvHeaders(headers);
      setCsvRows(rows);
    };
    reader.readAsText(file);
  };

  const resetCsv = () => {
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitPayload = async (students: RepRegisterPayload[]) => {
    if (students.length === 0) {
      toast.error('No valid rows to submit.');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await countryRepHttp.post<RepRegisterResult>('/rep/students', {
        students,
      });
      setResult(res);
      toast.success(
        `${res.registered} registered — ${res.created} new account(s), ${res.skipped} skipped.`,
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to register students');
    } finally {
      setSubmitting(false);
    }
  };

  const submitCsv = async () => {
    const students = csvRows.map(csvRowToPayload).filter((s) => s.fullName && s.email);
    if (students.length === 0) {
      toast.error('CSV is missing required columns — need fullName + email.');
      return;
    }
    await submitPayload(students);
  };

  const submitManual = async () => {
    const students = manualRows
      .filter((r) => isValidRow(r))
      .map<RepRegisterPayload>((r) => ({
        fullName: r.fullName.trim(),
        email: r.email.trim().toLowerCase(),
        grade: r.grade.trim() || undefined,
      }));
    if (students.length === 0) {
      toast.error('Add at least one student with a name and a valid email.');
      return;
    }
    await submitPayload(students);
  };

  const manualValidCount = manualRows.filter(isValidRow).length;
  const manualIssueCount = manualRows.filter((r) => !isRowEmpty(r) && !isValidRow(r)).length;
  const csvIssueCount = csvRows.filter(rowHasIssue).length;
  const csvValidCount = csvRows.length - csvIssueCount;

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={ctx ? `${ctx.competition.name} · ${ctx.country}` : 'Country Representative'}
        title="Bulk Registration"
        subtitle="Register many students for the local round from a CSV file or by pasting from a spreadsheet."
        actions={
          <Button asChild variant="outline">
            <Link href="/rep-portal/students">
              <ArrowLeft className="size-4" />
              Back to My Students
            </Link>
          </Button>
        }
      />

      {loading ? (
        <Card className="p-6">
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : !round ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Your local round hasn’t been set up yet
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            An organizer needs to create a local round for {ctx?.country ?? 'your country'} before
            you can register students.
          </p>
        </Card>
      ) : (
        <>
          {/* Round summary */}
          <Card className="gap-0 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
              Registering into
            </p>
            <p className="mt-1 font-serif text-lg font-medium text-foreground">{round.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Fee per student:{' '}
              <span className="font-medium text-foreground">
                {round.fee > 0 ? rupiah(round.fee) : 'Free'}
              </span>
            </p>
          </Card>

          {/* Last submission summary */}
          {result && (
            <Card className="grid grid-cols-3 gap-3 border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <div className="text-center">
                <div className="font-serif text-2xl font-medium text-emerald-700 dark:text-emerald-300">
                  {result.registered}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Registered</div>
              </div>
              <div className="text-center">
                <div className="font-serif text-2xl font-medium text-emerald-700 dark:text-emerald-300">
                  {result.created}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">New accounts</div>
              </div>
              <div className="text-center">
                <div className="font-serif text-2xl font-medium text-amber-700 dark:text-amber-300">
                  {result.skipped}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Skipped (dupes / invalid)</div>
              </div>
            </Card>
          )}

          <Card className="gap-4 p-5">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'csv' | 'manual')}>
              <TabsList className="grid w-full grid-cols-2 sm:w-fit">
                <TabsTrigger value="manual">Enter manually</TabsTrigger>
                <TabsTrigger value="csv">Upload CSV</TabsTrigger>
              </TabsList>

              {/* CSV mode */}
              <TabsContent value="csv" className="mt-4 space-y-4">
                <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                  CSV header row: <code className="font-mono">fullName, email, grade</code>{' '}
                  (grade optional). One student per row.
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={onFile}
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
                      <p className="mt-1 text-xs text-muted-foreground">
                        {csvRows.length} row(s) detected
                      </p>
                      <Button size="sm" variant="ghost" className="mt-2" onClick={resetCsv}>
                        <X className="size-3.5" />
                        Remove
                      </Button>
                    </>
                  ) : (
                    <>
                      <Upload className="mx-auto size-7 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">Upload your CSV file</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Browse file
                      </Button>
                    </>
                  )}
                </div>

                {csvRows.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                        Preview — {csvRows.length} row(s)
                      </p>
                      {csvIssueCount > 0 && (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-amber-100 font-mono text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                        >
                          {csvIssueCount} row{csvIssueCount > 1 ? 's' : ''} missing fullName / email
                        </Badge>
                      )}
                    </div>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table className="min-w-[1024px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            {csvHeaders.map((h) => (
                              <TableHead key={h} className="whitespace-nowrap">
                                {h}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {csvRows.slice(0, 50).map((row, i) => {
                            const issue = rowHasIssue(row);
                            return (
                              <TableRow
                                key={i}
                                className={cn(issue && 'bg-amber-50 dark:bg-amber-950/30')}
                              >
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {i + 1}
                                </TableCell>
                                {csvHeaders.map((h) => (
                                  <TableCell key={h} className="max-w-[200px] truncate">
                                    {row[h] || (
                                      <span className="italic text-muted-foreground">empty</span>
                                    )}
                                  </TableCell>
                                ))}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {csvRows.length > 50 && (
                        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                          Showing the first 50 of {csvRows.length}. All will be submitted.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Button
                    onClick={submitCsv}
                    disabled={csvValidCount === 0 || submitting}
                  >
                    {submitting
                      ? 'Submitting…'
                      : `Register ${csvValidCount} student${csvValidCount === 1 ? '' : 's'}`}
                  </Button>
                </div>
              </TabsContent>

              {/* Manual mode */}
              <TabsContent value="manual" className="mt-4 space-y-4">
                <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Just a handful of students? Type them in here, or paste a block from Excel /
                  Google Sheets — the grid splits cells automatically. Only{' '}
                  <strong>full name</strong>, <strong>email</strong>, and <strong>grade</strong>{' '}
                  are used for the local round.
                  {manualIssueCount > 0 && (
                    <span className="ml-1 font-medium text-amber-700 dark:text-amber-300">
                      {' '}{manualIssueCount} row{manualIssueCount === 1 ? '' : 's'} need
                      {manualIssueCount === 1 ? 's' : ''} a name and a valid email.
                    </span>
                  )}
                </div>
                <ManualEntryGrid rows={manualRows} onChange={setManualRows} />
                <div>
                  <Button
                    onClick={submitManual}
                    disabled={manualValidCount === 0 || submitting}
                  >
                    {submitting
                      ? 'Submitting…'
                      : `Register ${manualValidCount} student${manualValidCount === 1 ? '' : 's'}`}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </>
      )}
    </div>
  );
}
