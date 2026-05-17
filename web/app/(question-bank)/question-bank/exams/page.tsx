'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { CompetitionPicker, useQuestionBank } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ExamRow {
  id: string;
  code: string;
  name: string;
  date: string | null;
  grades: string[];
  minutes: number | null;
  questionCount: number;
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ExamsListPage() {
  const router = useRouter();
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      setRows(
        await questionBankHttp.get<ExamRow[]>(
          `/question-bank/exams?compId=${encodeURIComponent(selectedId)}`,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (ex: ExamRow) => {
    if (!confirm(`Delete exam ${ex.code}? This removes it and its question set.`)) return;
    setBusy(ex.id);
    try {
      await questionBankHttp.delete(`/question-bank/exams/${ex.id}`);
      toast.success(`${ex.code} removed.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete exam');
    } finally {
      setBusy(null);
    }
  };

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Question Bank" title="Exams" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Exams are available for native competitions only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Question Bank"
        title="Exams"
        subtitle="Assemble exams from approved questions. Students sit them in the competition portal."
        actions={
          <Button disabled={!selectedId} onClick={() => router.push('/question-bank/exams/new')}>
            <Plus className="size-4" />
            New exam
          </Button>
        }
      />

      <CompetitionPicker className="w-full sm:w-72" />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-32">Date</TableHead>
                <TableHead className="w-28">Grades</TableHead>
                <TableHead className="w-24">Questions</TableHead>
                <TableHead className="w-20">Minutes</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    No exams yet — create one from your approved questions.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((ex) => (
                  <TableRow
                    key={ex.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/question-bank/exams/${ex.id}`)}
                  >
                    <TableCell className="font-mono text-[12px] text-muted-foreground">
                      {ex.code}
                    </TableCell>
                    <TableCell className="truncate font-medium text-foreground">{ex.name}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {fmtDate(ex.date)}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {ex.grades.length ? ex.grades.join(', ') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {ex.questionCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {ex.minutes ?? '—'}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label="Edit"
                          onClick={() => router.push(`/question-bank/exams/${ex.id}`)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label="Delete"
                          disabled={busy === ex.id}
                          onClick={() => remove(ex)}
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
      </Card>
    </div>
  );
}
