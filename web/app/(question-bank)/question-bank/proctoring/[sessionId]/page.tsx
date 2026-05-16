'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Camera, CameraOff, Loader2 } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Snapshot {
  id: string;
  url: string;
  capturedAt: string;
}
interface ProctoringSession {
  id: string;
  studentName: string;
  examName: string;
  examCode: string;
  startedAt: string | null;
  finishedAt: string | null;
  cameraAvailable: boolean | null;
  snapshots: Snapshot[];
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
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ProctoringSessionPage() {
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<ProctoringSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    questionBankHttp
      .get<ProctoringSession>(`/question-bank/proctoring/sessions/${sessionId}`)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="mx-auto max-w-[900px] space-y-6 p-6 lg:p-8">
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">Session not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/question-bank/proctoring')}
          >
            <ArrowLeft className="size-4" />
            Back to proctoring
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 text-muted-foreground"
          onClick={() => router.push('/question-bank/proctoring')}
        >
          <ArrowLeft className="size-4" />
          Proctoring
        </Button>
        <PageHeader
          eyebrow={`Question Bank · ${data.examCode}`}
          title={data.studentName}
          subtitle={data.examName}
          actions={
            data.cameraAvailable === true ? (
              <Badge className="bg-emerald-600 font-mono text-[10px] text-white">
                <Camera className="size-3" /> Proctored
              </Badge>
            ) : data.cameraAvailable === false ? (
              <Badge
                variant="outline"
                className="border-transparent bg-amber-100 font-mono text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-200"
              >
                <CameraOff className="size-3" /> No camera
              </Badge>
            ) : undefined
          }
        />
      </div>

      <Card className="flex flex-wrap gap-6 p-5 text-sm">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Started
          </p>
          <p className="text-foreground">{fmtDateTime(data.startedAt)}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Finished
          </p>
          <p className="text-foreground">{fmtDateTime(data.finishedAt)}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Snapshots
          </p>
          <p className="text-foreground">{data.snapshots.length}</p>
        </div>
      </Card>

      {data.cameraAvailable === false ? (
        <Card className="p-12 text-center">
          <CameraOff className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">No camera during this attempt</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The student did not grant camera access — the exam ran unproctored.
          </p>
        </Card>
      ) : data.snapshots.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          No webcam snapshots were captured for this attempt.
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.snapshots.map((snap) => (
            <Card key={snap.id} className="gap-0 overflow-hidden p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={snap.url}
                alt={`Snapshot at ${fmtTime(snap.capturedAt)}`}
                className="aspect-[4/3] w-full bg-muted object-cover"
              />
              <p className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                {fmtTime(snap.capturedAt)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
