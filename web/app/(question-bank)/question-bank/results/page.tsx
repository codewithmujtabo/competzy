'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { CompetitionPicker, useQuestionBank } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { useT } from '@/lib/i18n/context';
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

interface ResultRow {
  sessionId: string;
  examName: string;
  examCode: string;
  studentName: string;
  grade: string | null;
  finishedAt: string;
  totalPoint: number | null;
  awaitingGrading: boolean;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ExamResultsPage() {
  const t = useT();
  const router = useRouter();
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    questionBankHttp
      .get<ResultRow[]>(`/question-bank/results?compId=${encodeURIComponent(selectedId)}`)
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load exam results'))
      .finally(() => setLoading(false));
  }, [selectedId]);

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow={t('opnav.questionBank')} title={t('opnav.results')} />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Exam results are available for native competitions only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={t('opnav.questionBank')}
        title={t('opnav.results')}
        subtitle={t('qb.resultsSubtitle')}
      />

      <CompetitionPicker className="w-full sm:w-72" />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed min-w-[1024px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-28 truncate">Exam</TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="w-20 truncate">Grade</TableHead>
                <TableHead className="w-32 truncate">Submitted</TableHead>
                <TableHead className="w-32 truncate">Score</TableHead>
                <TableHead className="w-24 text-right truncate">Action</TableHead>
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
                    No finished attempts yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={r.sessionId}
                    className="cursor-pointer"
                    onClick={() => router.push(`/question-bank/results/${r.sessionId}`)}
                  >
                    <TableCell className="font-mono text-[12px] text-muted-foreground">
                      {r.examCode}
                    </TableCell>
                    <TableCell className="truncate font-medium text-foreground">
                      {r.studentName}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {r.grade ?? '-'}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {fmtDate(r.finishedAt)}
                    </TableCell>
                    <TableCell>
                      <span className="font-serif text-base font-medium text-foreground">
                        {r.totalPoint ?? 0}
                      </span>
                      {r.awaitingGrading && (
                        <Badge
                          variant="outline"
                          className="ml-2 border-transparent bg-amber-100 font-mono text-[9px] text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                        >
                          partial
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/question-bank/results/${r.sessionId}`)}
                      >
                        View
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
