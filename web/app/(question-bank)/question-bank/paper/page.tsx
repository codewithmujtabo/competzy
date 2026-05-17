'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Search, Trash2 } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { CompetitionPicker, useQuestionBank } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ExamLite {
  id: string;
  code: string;
  name: string;
}
interface PaperExam {
  id: string;
  studentName: string;
  grade: string | null;
  totalPoint: number | null;
  answerCount: number;
}
interface Student {
  userId: string;
  name: string;
  grade: string | null;
  hasPaper: boolean;
}

export default function PaperExamsPage() {
  const router = useRouter();
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();
  const [exams, setExams] = useState<ExamLite[]>([]);
  const [examId, setExamId] = useState('');
  const [paperExams, setPaperExams] = useState<PaperExam[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentFilter, setStudentFilter] = useState('');
  const [creating, setCreating] = useState(false);

  // Exams for the picked competition.
  useEffect(() => {
    setExamId('');
    setPaperExams([]);
    if (!selectedId) {
      setExams([]);
      return;
    }
    questionBankHttp
      .get<ExamLite[]>(`/question-bank/exams?compId=${encodeURIComponent(selectedId)}`)
      .then(setExams)
      .catch(() => setExams([]));
  }, [selectedId]);

  const loadPaperExams = useCallback(async () => {
    if (!examId) {
      setPaperExams([]);
      return;
    }
    setLoading(true);
    try {
      setPaperExams(
        await questionBankHttp.get<PaperExam[]>(
          `/question-bank/paper-exams?examId=${encodeURIComponent(examId)}`,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load paper exams');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    loadPaperExams();
  }, [loadPaperExams]);

  const openAdd = async () => {
    if (!examId) return;
    setStudentFilter('');
    setAddOpen(true);
    try {
      setStudents(
        await questionBankHttp.get<Student[]>(`/question-bank/exams/${examId}/students`),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load students');
    }
  };

  const create = async (userId: string) => {
    setCreating(true);
    try {
      const pe = await questionBankHttp.post<{ id: string }>('/question-bank/paper-exams', {
        examId,
        userId,
      });
      toast.success('Paper exam created.');
      setAddOpen(false);
      router.push(`/question-bank/paper/${pe.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create the paper exam');
    } finally {
      setCreating(false);
    }
  };

  const remove = async (pe: PaperExam) => {
    if (!confirm(`Delete the paper result for ${pe.studentName}?`)) return;
    setBusy(pe.id);
    try {
      await questionBankHttp.delete(`/question-bank/paper-exams/${pe.id}`);
      toast.success('Paper exam removed.');
      await loadPaperExams();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setBusy(null);
    }
  };

  const eligible = students.filter(
    (s) =>
      !s.hasPaper &&
      (!studentFilter.trim() || s.name.toLowerCase().includes(studentFilter.trim().toLowerCase())),
  );

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Question Bank" title="Paper Exams" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Paper exams are available for native competitions only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Question Bank"
        title="Paper Exams"
        subtitle="Record and grade the results of students who sat an exam on paper."
        actions={
          <Button disabled={!examId} onClick={openAdd}>
            <Plus className="size-4" />
            Add paper result
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <CompetitionPicker className="w-full sm:w-72" />
        <Select value={examId || undefined} onValueChange={setExamId}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Select an exam…" />
          </SelectTrigger>
          <SelectContent>
            {exams.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.code} — {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!examId ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Select an exam above to record paper results.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="w-24">Grade</TableHead>
                  <TableHead className="w-28">Answers</TableHead>
                  <TableHead className="w-24">Score</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-9 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paperExams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                      No paper results recorded for this exam yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  paperExams.map((pe) => (
                    <TableRow
                      key={pe.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/question-bank/paper/${pe.id}`)}
                    >
                      <TableCell className="truncate font-medium text-foreground">
                        {pe.studentName}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {pe.grade ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {pe.answerCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-foreground">
                        {pe.totalPoint ?? 0}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => router.push(`/question-bank/paper/${pe.id}`)}>
                            Open
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label="Delete"
                            disabled={busy === pe.id}
                            onClick={() => remove(pe)}
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
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a paper result</DialogTitle>
            <DialogDescription>
              Pick a registered student who sat this exam on paper.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search students…"
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
            />
          </div>
          {eligible.length === 0 ? (
            <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
              No registered students without a paper result.
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {eligible.map((s) => (
                <li key={s.userId}>
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => create(s.userId)}
                    className="flex w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <span className="truncate text-foreground">{s.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {s.grade ?? '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
