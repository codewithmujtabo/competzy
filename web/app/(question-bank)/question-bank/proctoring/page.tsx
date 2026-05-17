'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Camera, CameraOff, Video } from 'lucide-react';
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

interface ProctoringSession {
  sessionId: string;
  studentName: string;
  examName: string;
  examCode: string;
  startedAt: string | null;
  finishedAt: string | null;
  cameraAvailable: boolean | null;
  webcamCount: number;
}

function fmtDateTime(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CameraCell({ available }: { available: boolean | null }) {
  if (available === true) {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Camera className="size-3.5" /> Proctored
      </span>
    );
  }
  if (available === false) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
        <CameraOff className="size-3.5" /> No camera
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

export default function ProctoringPage() {
  const router = useRouter();
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<ProctoringSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    questionBankHttp
      .get<ProctoringSession[]>(
        `/question-bank/proctoring/sessions?compId=${encodeURIComponent(selectedId)}`,
      )
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load sessions'))
      .finally(() => setLoading(false));
  }, [selectedId]);

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Question Bank" title="Proctoring" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Proctoring review is available for native competitions only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Question Bank"
        title="Proctoring"
        subtitle="Webcam snapshots captured during online exam attempts."
      />

      <CompetitionPicker className="w-full sm:w-72" />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead className="w-40">Started</TableHead>
                <TableHead className="w-28">Camera</TableHead>
                <TableHead className="w-24">Snapshots</TableHead>
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
                    No online exam attempts for this competition yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((s) => (
                  <TableRow
                    key={s.sessionId}
                    className="cursor-pointer"
                    onClick={() => router.push(`/question-bank/proctoring/${s.sessionId}`)}
                  >
                    <TableCell className="truncate font-medium text-foreground">
                      {s.studentName}
                    </TableCell>
                    <TableCell className="truncate text-sm text-muted-foreground">
                      {s.examName}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {fmtDateTime(s.startedAt)}
                    </TableCell>
                    <TableCell>
                      <CameraCell available={s.cameraAvailable} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {s.webcamCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/question-bank/proctoring/${s.sessionId}`)}
                      >
                        <Video className="size-3.5" />
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
