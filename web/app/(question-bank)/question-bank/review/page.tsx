'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ClipboardCheck } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { CompetitionPicker, useQuestionBank } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
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

interface QuestionRow {
  id: string;
  code: string;
  type: string;
  grades: string[];
  content: string;
  writerName: string | null;
  updatedAt: string;
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    questionBankHttp
      .get<QuestionRow[]>(
        `/question-bank/questions?compId=${encodeURIComponent(selectedId)}&status=submitted`,
      )
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load the review queue'))
      .finally(() => setLoading(false));
  }, [selectedId]);

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Question Bank" title="Review" />
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
        title="Review"
        subtitle="Questions submitted for review. Open one to approve it or send it back."
      />

      <CompetitionPicker className="w-full sm:w-72" />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Code</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-24">Grades</TableHead>
                <TableHead className="w-36">Writer</TableHead>
                <TableHead className="w-28 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    Nothing awaiting review — the queue is clear.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((q) => (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/question-bank/review/${q.id}`)}
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
                    <TableCell className="truncate text-xs text-muted-foreground">
                      {q.writerName ?? '—'}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" onClick={() => router.push(`/question-bank/review/${q.id}`)}>
                        <ClipboardCheck className="size-3.5" />
                        Review
                      </Button>
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
