'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Award, CreditCard, UserPlus, Upload } from 'lucide-react';
import { countryRepHttp } from '@/lib/api/client';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RepStudent {
  registrationId: string;
  status: string;
  score: number | null;
  isMedalist: boolean | null;
  userId: string;
  fullName: string;
  email: string;
  grade: string | null;
}

interface RepContext {
  country: string;
  competition: { id: string; name: string };
  localRound: {
    id: string;
    name: string;
    fee: number;
    examMode: string;
    qualifyingScore: number | null;
    examDate: string | null;
  } | null;
  students: RepStudent[];
}

function rupiah(n: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}

// Minimal CSV parser — the first row is the header; values are comma-separated.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
}

// A CSV-upload dialog — parses the file client-side and hands the rows to `onImport`.
function CsvDialog({
  open,
  onClose,
  title,
  description,
  header,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  header: string;
  onImport: (rows: Record<string, string>[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setRows(parseCsv(String(reader.result ?? '')));
    reader.readAsText(file);
  };

  const submit = async () => {
    if (rows.length === 0) {
      toast.error('Upload a CSV with at least one data row.');
      return;
    }
    setBusy(true);
    try {
      await onImport(rows);
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            CSV header row: {header}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />
          {fileName && (
            <p className="text-xs text-muted-foreground">
              {fileName} — <span className="font-medium text-foreground">{rows.length}</span> row(s)
              parsed
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || rows.length === 0}>
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RepPortalPage() {
  const [ctx, setCtx] = useState<RepContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<'students' | 'scores' | null>(null);
  const [paying, setPaying] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCtx(await countryRepHttp.get<RepContext>('/rep/context'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load your portal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const importStudents = async (rows: Record<string, string>[]) => {
    const students = rows
      .map((r) => ({
        fullName: r.fullname || r.name || r['full name'] || '',
        email: r.email || '',
        grade: r.grade || '',
      }))
      .filter((s) => s.email && s.fullName);
    if (students.length === 0) {
      throw new Error('No valid rows — the CSV needs fullName + email columns.');
    }
    const res = await countryRepHttp.post<{
      created: number;
      registered: number;
      skipped: number;
    }>('/rep/students', { students });
    toast.success(
      `${res.registered} registered — ${res.created} new account(s), ${res.skipped} skipped.`,
    );
    await load();
  };

  const importScores = async (rows: Record<string, string>[]) => {
    const scores = rows
      .map((r) => ({ email: r.email || '', score: Number(r.score) }))
      .filter((s) => s.email && Number.isFinite(s.score));
    if (scores.length === 0) {
      throw new Error('No valid rows — the CSV needs email + score columns.');
    }
    const res = await countryRepHttp.post<{ updated: number; notFound: string[] }>(
      '/rep/import-scores',
      { scores },
    );
    toast.success(
      `${res.updated} score(s) imported${
        res.notFound.length ? ` — ${res.notFound.length} email(s) not found` : ''
      }.`,
    );
    await load();
  };

  const payBatch = async () => {
    setPaying(true);
    try {
      const res = await countryRepHttp.post<{ batchId: string; redirectUrl?: string }>(
        '/rep/pay-batch',
        {},
      );
      if (res.redirectUrl) window.open(res.redirectUrl, '_blank', 'noopener');
      let tries = 0;
      pollTimer.current = setInterval(async () => {
        tries += 1;
        if (tries > 40) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setPaying(false);
          return;
        }
        try {
          const v = await countryRepHttp.get<{ status: string }>(
            `/rep/pay-batch/${res.batchId}/verify`,
          );
          if (v.status === 'paid') {
            if (pollTimer.current) clearInterval(pollTimer.current);
            setPaying(false);
            toast.success('Payment received — your students are now registered.');
            await load();
          }
        } catch {
          /* transient — keep polling */
        }
      }, 4000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start the payment');
      setPaying(false);
    }
  };

  const round = ctx?.localRound;
  const unpaidCount =
    ctx?.students.filter((s) => s.status === 'pending_payment').length ?? 0;

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={ctx ? `${ctx.competition.name} · ${ctx.country}` : 'Country Representative'}
        title="My Students"
        subtitle="Register your country's students for the local round and import their exam scores."
        actions={
          round ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialog('students')}>
                <UserPlus className="size-4" />
                Add students
              </Button>
              <Button onClick={() => setDialog('scores')}>
                <Upload className="size-4" />
                Import scores
              </Button>
            </div>
          ) : undefined
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
          <Card className="gap-0 p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
              Local round
            </p>
            <h2 className="mt-1 font-serif text-xl font-medium text-foreground">{round.name}</h2>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
              <span>
                Exam: <span className="text-foreground">{round.examMode}</span>
              </span>
              <span>
                Fee:{' '}
                <span className="text-foreground">
                  {round.fee > 0 ? rupiah(round.fee) : 'Free'}
                </span>
              </span>
              {round.qualifyingScore != null && (
                <span>
                  Medal score: <span className="text-foreground">≥ {round.qualifyingScore}</span>
                </span>
              )}
              <span>
                Students: <span className="text-foreground">{ctx?.students.length ?? 0}</span>
              </span>
            </div>
            {unpaidCount > 0 && round.fee > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
                <Button onClick={payBatch} disabled={paying}>
                  <CreditCard className="size-4" />
                  {paying
                    ? 'Waiting for payment…'
                    : `Pay ${rupiah(unpaidCount * round.fee)} — ${unpaidCount} unpaid student(s)`}
                </Button>
                {paying && (
                  <span className="text-xs text-muted-foreground">
                    Finish in the new tab — this page updates automatically.
                  </span>
                )}
              </div>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-20">Grade</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-20">Score</TableHead>
                    <TableHead className="w-24">Medal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ctx?.students.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                        No students yet — use “Add students” to register them.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ctx?.students.map((s) => (
                      <TableRow key={s.registrationId}>
                        <TableCell className="font-medium text-foreground">{s.fullName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                        <TableCell className="text-sm">{s.grade ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {s.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {s.score != null ? s.score : '—'}
                        </TableCell>
                        <TableCell>
                          {s.isMedalist ? (
                            <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                              <Award className="size-4" />
                              Medal
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      <CsvDialog
        open={dialog === 'students'}
        onClose={() => setDialog(null)}
        title="Add students"
        description="Upload a CSV of the students to register for this local round."
        header="fullName, email, grade"
        onImport={importStudents}
      />
      <CsvDialog
        open={dialog === 'scores'}
        onClose={() => setDialog(null)}
        title="Import exam scores"
        description="Upload a CSV of your students' offline-exam scores. Scores at or above the round's medal score qualify the student for the Global Round."
        header="email, score"
        onImport={importScores}
      />
    </div>
  );
}
