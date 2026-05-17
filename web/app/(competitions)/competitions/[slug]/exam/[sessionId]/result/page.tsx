'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Section {
  choice?: number;
  short?: number;
}
interface SessionResult {
  examName: string;
  finishedAt: string | null;
  result: {
    totalPoint: number;
    corrects: Section;
    wrongs: Section;
    blanks: Section;
    awaitingGrading: boolean;
  } | null;
}

const sum = (o: Section) => (o.choice ?? 0) + (o.short ?? 0);

export default function ExamResultPage() {
  const router = useRouter();
  const { slug, sessionId } = useParams<{ slug: string; sessionId: string }>();
  const [data, setData] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    emcHttp
      .get<SessionResult>(`/sessions/${sessionId}`)
      .then((s) => {
        if (!s.finishedAt) {
          // Not submitted yet — back to the player.
          router.replace(`/competitions/${slug}/exam/${sessionId}`);
          return;
        }
        setData(s);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !data || !data.result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-foreground">Result not available</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href={`/competitions/${slug}/dashboard`}>Back to dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const r = data.result;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-xl space-y-6 p-6 lg:p-12">
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-6" />
          </span>
          <h1 className="mt-3 font-serif text-2xl font-medium text-foreground">Exam submitted</h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.examName}</p>
        </div>

        <Card className="items-center gap-1 p-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Your score
          </p>
          <p className="font-serif text-5xl font-medium text-foreground">{r.totalPoint}</p>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card className="items-center gap-0 p-4 text-center">
            <p className="font-serif text-2xl font-medium text-emerald-600 dark:text-emerald-400">
              {sum(r.corrects)}
            </p>
            <p className="text-xs text-muted-foreground">Correct</p>
          </Card>
          <Card className="items-center gap-0 p-4 text-center">
            <p className="font-serif text-2xl font-medium text-red-600 dark:text-red-400">
              {sum(r.wrongs)}
            </p>
            <p className="text-xs text-muted-foreground">Wrong</p>
          </Card>
          <Card className="items-center gap-0 p-4 text-center">
            <p className="font-serif text-2xl font-medium text-muted-foreground">
              {sum(r.blanks)}
            </p>
            <p className="text-xs text-muted-foreground">Blank</p>
          </Card>
        </div>

        {r.awaitingGrading && (
          <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            Some short-answer responses are still being graded — your final score may change once
            review is complete.
          </div>
        )}

        <div className="text-center">
          <Button asChild variant="outline">
            <Link href={`/competitions/${slug}/dashboard`}>Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
