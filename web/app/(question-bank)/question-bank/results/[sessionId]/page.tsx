'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Option {
  id: string;
  content: string;
  isCorrect: boolean;
  chosen: boolean;
}
interface Period {
  id: string;
  number: number;
  type: string;
  questionContent: string;
  explanation: string | null;
  isCorrect: boolean | null;
  point: number | null;
  studentAnswer: string | null;
  options: Option[];
  answerKey: string | null;
}
interface ResultSession {
  id: string;
  examName: string;
  examCode: string;
  studentName: string;
  grade: string | null;
  totalPoint: number | null;
  corrects: { choice?: number; short?: number };
  wrongs: { choice?: number; short?: number };
  blanks: { choice?: number; short?: number };
  periods: Period[];
}

const sum = (o: { choice?: number; short?: number }) => (o.choice ?? 0) + (o.short ?? 0);

// Read-only review of one student's finished exam attempt. Reuses the operator
// grading-session endpoint for its data (answer keys + explanations exposed);
// the grading controls live on /question-bank/grading — this page only shows.
export default function ExamResultDetailPage() {
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<ResultSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    questionBankHttp
      .get<ResultSession>(`/question-bank/grading/sessions/${sessionId}`)
      .then(setSession)
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

  if (notFound || !session) {
    return (
      <div className="mx-auto max-w-[900px] space-y-6 p-6 lg:p-8">
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">Attempt not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/question-bank/results')}
          >
            <ArrowLeft className="size-4" />
            Back to results
          </Button>
        </Card>
      </div>
    );
  }

  const pendingShort = session.periods.filter(
    (p) => p.type === 'short' && p.isCorrect == null && p.studentAnswer && p.studentAnswer.trim(),
  ).length;

  return (
    <div className="mx-auto max-w-[900px] space-y-6 p-6 lg:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 text-muted-foreground"
          onClick={() => router.push('/question-bank/results')}
        >
          <ArrowLeft className="size-4" />
          Results
        </Button>
        <PageHeader
          eyebrow={`Question Bank · ${session.examCode}`}
          title={session.studentName}
          subtitle={session.grade ? `Grade ${session.grade} · ${session.examName}` : session.examName}
        />
      </div>

      <Card className="flex flex-wrap items-center gap-6 p-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Total score
          </p>
          <p className="font-serif text-2xl font-medium text-foreground">
            {session.totalPoint ?? 0}
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-emerald-600 dark:text-emerald-400">
            {sum(session.corrects)} correct
          </span>
          <span className="text-red-600 dark:text-red-400">{sum(session.wrongs)} wrong</span>
          <span className="text-muted-foreground">{sum(session.blanks)} blank</span>
        </div>
        {pendingShort > 0 && (
          <Badge
            variant="outline"
            className="ml-auto border-transparent bg-amber-100 font-mono text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            {pendingShort} awaiting grading
          </Badge>
        )}
      </Card>

      <div className="space-y-4">
        {session.periods.map((p) => (
          <Card key={p.id} className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                Q{p.number}
              </Badge>
              <Badge variant="outline" className="font-mono text-[9px]">
                {p.type === 'short' ? 'Short answer' : 'Multiple choice'}
              </Badge>
              {p.isCorrect === true && (
                <Badge className="bg-emerald-600 font-mono text-[9px] text-white">
                  Correct · {p.point ?? 0}
                </Badge>
              )}
              {p.isCorrect === false && (
                <Badge variant="destructive" className="font-mono text-[9px]">
                  Wrong · {p.point ?? 0}
                </Badge>
              )}
              {p.isCorrect == null && p.studentAnswer && p.studentAnswer.trim() && (
                <Badge
                  variant="outline"
                  className="border-transparent bg-amber-100 font-mono text-[9px] text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                >
                  Awaiting grading
                </Badge>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">{p.questionContent}</p>

            {p.type === 'choice' ? (
              <ul className="space-y-1.5">
                {p.options.map((o) => (
                  <li
                    key={o.id}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
                      o.isCorrect && 'border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/40',
                      o.chosen && !o.isCorrect && 'border-red-300/60 bg-red-50 dark:bg-red-950/40',
                    )}
                  >
                    <span className="flex-1 text-foreground">{o.content}</span>
                    {o.isCorrect && <span className="text-xs text-emerald-600">key</span>}
                    {o.chosen && (
                      <Badge variant="outline" className="font-mono text-[9px]">
                        chosen
                      </Badge>
                    )}
                  </li>
                ))}
                {!p.options.some((o) => o.chosen) && (
                  <li className="text-xs text-muted-foreground">— left blank —</li>
                )}
              </ul>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      Student&apos;s answer
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {p.studentAnswer && p.studentAnswer.trim() ? p.studentAnswer : '— blank —'}
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      Answer key
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {p.answerKey ?? '—'}
                    </p>
                  </div>
                </div>
                {p.explanation && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Explanation:</span> {p.explanation}
                  </p>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
