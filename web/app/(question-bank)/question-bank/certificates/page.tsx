'use client';

// Operator certificate management (EMC Wave 12 Phase 3).
// Certificates are auto-issued when a student finishes a competition exam — the
// operator does not issue them here. This page lets an operator review issued
// certificates, add an award label (→ Certificate of Achievement), adjust the
// score, revoke/restore, delete, and run an on-demand backfill.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Award,
  Ban,
  FileDown,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { certificatesHttp } from '@/lib/api/client';
import { useQuestionBank, CompetitionPicker } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { Pager } from '@/components/shell/pager';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface Certificate {
  id: string;
  compId: string;
  certificateNumber: string;
  verificationCode: string;
  type: string;
  awardLabel: string | null;
  studentName: string;
  competitionName: string;
  grade: string | null;
  score: number | null;
  scoreMax: number | null;
  scoreLocked: boolean;
  issuedAt: string;
  revokedAt: string | null;
}

interface ListResponse {
  certificates: Certificate[];
  pagination: { total: number; page: number; limit: number };
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const scoreText = (c: Pick<Certificate, 'score' | 'scoreMax'>) =>
  c.score == null ? '—' : `${c.score}${c.scoreMax != null ? ` / ${c.scoreMax}` : ''}`;

export default function CertificatesPage() {
  const { competitions, selectedId, loading: compsLoading } = useQuestionBank();

  const [rows, setRows] = useState<Certificate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const [editing, setEditing] = useState<Certificate | null>(null);
  const [form, setForm] = useState({ awardLabel: '', score: '', scoreMax: '' });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const LIMIT = 20;

  const load = useCallback(async () => {
    if (!selectedId) {
      setRows([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ compId: selectedId, page: String(page) });
      if (search.trim()) q.set('search', search.trim());
      const r = await certificatesHttp.get<ListResponse>(`/certificates/manage?${q}`);
      setRows(r.certificates);
      setTotal(r.pagination.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [selectedId, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when the scope or search changes.
  useEffect(() => {
    setPage(1);
  }, [selectedId, search]);

  const runBackfill = async () => {
    if (!selectedId) return;
    setBackfilling(true);
    try {
      const r = await certificatesHttp.post<{ issued: number; refreshed: number }>(
        `/certificates/manage/backfill?compId=${encodeURIComponent(selectedId)}`,
        {},
      );
      toast.success(`Backfill done — ${r.issued} issued, ${r.refreshed} score(s) refreshed.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  };

  const openEdit = (c: Certificate) => {
    setEditing(c);
    setForm({
      awardLabel: c.awardLabel ?? '',
      score: c.score == null ? '' : String(c.score),
      scoreMax: c.scoreMax == null ? '' : String(c.scoreMax),
    });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { awardLabel: form.awardLabel.trim() || null };
      // Only send score fields when changed — touching the score locks it from
      // the nightly backfill sync.
      const origScore = editing.score == null ? '' : String(editing.score);
      const origMax = editing.scoreMax == null ? '' : String(editing.scoreMax);
      if (form.score !== origScore) {
        body.score = form.score.trim() === '' ? null : Number(form.score);
      }
      if (form.scoreMax !== origMax) {
        body.scoreMax = form.scoreMax.trim() === '' ? null : Number(form.scoreMax);
      }
      await certificatesHttp.put(`/certificates/manage/${editing.id}`, body);
      toast.success('Certificate updated.');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update the certificate');
    } finally {
      setSaving(false);
    }
  };

  const toggleRevoke = async (c: Certificate) => {
    const revoking = !c.revokedAt;
    if (revoking && !confirm(`Revoke certificate ${c.certificateNumber}? It will verify as REVOKED.`))
      return;
    setBusy(c.id);
    try {
      await certificatesHttp.post(
        `/certificates/manage/${c.id}/${revoking ? 'revoke' : 'restore'}`,
        {},
      );
      toast.success(revoking ? 'Certificate revoked.' : 'Certificate restored.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to change the certificate');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (c: Certificate) => {
    if (!confirm(`Delete certificate ${c.certificateNumber}? This cannot be undone here.`)) return;
    setBusy(c.id);
    try {
      await certificatesHttp.delete(`/certificates/manage/${c.id}`);
      toast.success('Certificate removed.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete the certificate');
    } finally {
      setBusy(null);
    }
  };

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Results" title="Certificates" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No competitions to manage</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Results"
        title="Certificates"
        subtitle="Certificates are issued automatically when a student finishes an exam. Add an award label, adjust the score, or revoke."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <CompetitionPicker />
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search student or number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64"
          />
          <Button variant="outline" onClick={runBackfill} disabled={!selectedId || backfilling}>
            <RefreshCw className={`size-4 ${backfilling ? 'animate-spin' : ''}`} />
            Run backfill
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1024px]">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="w-44">Number</TableHead>
                <TableHead className="w-32">Type</TableHead>
                <TableHead>Award label</TableHead>
                <TableHead className="w-24">Score</TableHead>
                <TableHead className="w-28">Issued</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                    No certificates yet — they appear once students finish an exam. Try “Run
                    backfill”.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => openEdit(c)}>
                    <TableCell>
                      <span className="font-medium text-foreground">{c.studentName}</span>
                      {c.grade && (
                        <span className="ml-2 text-xs text-muted-foreground">{c.grade}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.certificateNumber}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          c.type === 'achievement'
                            ? 'border-transparent bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                            : 'border-transparent bg-muted text-[10px] text-muted-foreground'
                        }
                      >
                        {c.type === 'achievement' ? 'Achievement' : 'Participation'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.awardLabel || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{scoreText(c)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(c.issuedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          c.revokedAt
                            ? 'border-transparent bg-rose-100 text-[10px] text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                            : 'border-transparent bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                        }
                      >
                        {c.revokedAt ? 'Revoked' : 'Valid'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          title="View PDF"
                          asChild
                        >
                          <a
                            href={`/api/certificates/verify/${c.verificationCode}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FileDown className="size-3.5" />
                          </a>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          title="Edit"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          title={c.revokedAt ? 'Restore' : 'Revoke'}
                          disabled={busy === c.id}
                          onClick={() => toggleRevoke(c)}
                        >
                          {c.revokedAt ? (
                            <RotateCcw className="size-3.5" />
                          ) : (
                            <Ban className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          title="Delete"
                          disabled={busy === c.id}
                          onClick={() => remove(c)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="size-4 text-primary" />
              Edit certificate
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `${editing.studentName} · ${editing.certificateNumber}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Award label</Label>
              <Input
                value={form.awardLabel}
                onChange={(e) => setForm((f) => ({ ...f, awardLabel: e.target.value }))}
                placeholder="e.g. Gold Medal, Finalist"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Setting a label makes this a Certificate of Achievement. Leave blank for a
                Certificate of Participation.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">Score</Label>
                <Input
                  type="number"
                  value={form.score}
                  onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
                  placeholder="—"
                />
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">Max score</Label>
                <Input
                  type="number"
                  value={form.scoreMax}
                  onChange={(e) => setForm((f) => ({ ...f, scoreMax: e.target.value }))}
                  placeholder="—"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Editing the score locks it — the nightly backfill will stop syncing it from exam
              results.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
