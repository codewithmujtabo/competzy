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
import { cn } from '@/lib/utils';

interface QuestionRow {
  id: string;
  code: string;
  type: string;
  level: string | null;
  grades: string[];
  status: string;
  content: string;
  writerName: string | null;
}

interface Subject {
  id: string;
  name: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  submitted: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
};

const ALL = '__all__';

export default function QuestionsListPage() {
  const router = useRouter();
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(ALL);
  const [subjectId, setSubjectId] = useState(ALL);
  const [grade, setGrade] = useState(ALL);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ compId: selectedId });
      if (status !== ALL) qs.set('status', status);
      if (subjectId !== ALL) qs.set('subjectId', subjectId);
      if (grade !== ALL) qs.set('grade', grade);
      setRows(await questionBankHttp.get<QuestionRow[]>(`/question-bank/questions?${qs}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [selectedId, status, subjectId, grade]);

  useEffect(() => {
    load();
  }, [load]);

  // Subjects for the filter — reload + reset filters when the competition changes.
  useEffect(() => {
    setStatus(ALL);
    setSubjectId(ALL);
    setGrade(ALL);
    if (!selectedId) {
      setSubjects([]);
      return;
    }
    questionBankHttp
      .get<Subject[]>(`/question-bank/subjects?compId=${encodeURIComponent(selectedId)}`)
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, [selectedId]);

  const remove = async (q: QuestionRow) => {
    if (!confirm(`Delete ${q.code}? This removes it from the bank.`)) return;
    setBusy(q.id);
    try {
      await questionBankHttp.delete(`/question-bank/questions/${q.id}`);
      toast.success(`${q.code} removed.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete question');
    } finally {
      setBusy(null);
    }
  };

  const gradeOptions = ['SD', 'SMP', 'SMA'];

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Question Bank" title="Questions" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The question bank is available for native competitions only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Question Bank"
        title="Questions"
        subtitle="Author multiple-choice and short-answer questions, then submit them for review."
        actions={
          <Button
            disabled={!selectedId}
            onClick={() => router.push('/question-bank/questions/new')}
          >
            <Plus className="size-4" />
            New question
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <CompetitionPicker className="w-full sm:w-72" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All subjects</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All grades</SelectItem>
            {gradeOptions.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Code</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-24">Grades</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-36">Writer</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    No questions in this view yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((q) => (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/question-bank/questions/${q.id}`)}
                  >
                    <TableCell className="font-mono text-[12px] text-muted-foreground">
                      {q.code}
                    </TableCell>
                    <TableCell className="truncate text-sm text-foreground">{q.content}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {q.type === 'short_answer' ? 'Short answer' : 'Multiple choice'}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {q.grades.length ? q.grades.join(', ') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-transparent font-mono text-[10px] capitalize',
                          STATUS_STYLE[q.status] ?? 'bg-muted text-muted-foreground',
                        )}
                      >
                        {q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="truncate text-xs text-muted-foreground">
                      {q.writerName ?? '—'}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label="Edit"
                          onClick={() => router.push(`/question-bank/questions/${q.id}`)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label="Delete"
                          disabled={busy === q.id}
                          onClick={() => remove(q)}
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
