'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PenLine } from 'lucide-react';
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

interface QueueRow {
  sessionId: string;
  examName: string;
  examCode: string;
  studentName: string;
  grade: string | null;
  finishedAt: string;
  pendingCount: number;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function GradingQueuePage() {
  const router = useRouter();
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    questionBankHttp
      .get<QueueRow[]>(`/question-bank/grading/queue?compId=${encodeURIComponent(selectedId)}`)
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load the grading queue'))
      .finally(() => setLoading(false));
  }, [selectedId]);

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Question Bank" title="Grading" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Exam grading is available for native competitions only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Question Bank"
        title="Grading"
        subtitle="Exam attempts with short-answer responses awaiting a manual grade."
      />

      <CompetitionPicker className="w-full sm:w-72" />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Exam</TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="w-24">Grade</TableHead>
                <TableHead className="w-32">Submitted</TableHead>
                <TableHead className="w-28">Pending</TableHead>
                <TableHead className="w-24 text-right">Action</TableHead>
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
                    Nothing awaiting grading — the queue is clear.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={r.sessionId}
                    className="cursor-pointer"
                    onClick={() => router.push(`/question-bank/grading/${r.sessionId}`)}
                  >
                    <TableCell className="font-mono text-[12px] text-muted-foreground">
                      {r.examCode}
                    </TableCell>
                    <TableCell className="truncate font-medium text-foreground">
                      {r.studentName}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {r.grade ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {fmtDate(r.finishedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {r.pendingCount} to grade
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" onClick={() => router.push(`/question-bank/grading/${r.sessionId}`)}>
                        <PenLine className="size-3.5" />
                        Grade
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
