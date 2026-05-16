'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2, X } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
interface GradingSession {
  id: string;
  examName: string;
  examCode: string;
  studentName: string;
  grade: string | null;
  totalPoint: number | null;
  suggestedCorrectPoint: number;
  suggestedWrongPoint: number;
  corrects: { choice?: number; short?: number };
  wrongs: { choice?: number; short?: number };
  blanks: { choice?: number; short?: number };
  periods: Period[];
}

const sum = (o: { choice?: number; short?: number }) => (o.choice ?? 0) + (o.short ?? 0);

export default function GradingSessionPage() {
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<GradingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [points, setPoints] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const g = await questionBankHttp.get<GradingSession>(
        `/question-bank/grading/sessions/${sessionId}`,
      );
      setSession(g);
      setPoints((prev) => {
        const next = { ...prev };
        for (const p of g.periods) {
          if (p.type === 'short' && next[p.id] === undefined) {
            next[p.id] =
              p.point != null ? String(p.point) : String(g.suggestedCorrectPoint);
          }
        }
        return next;
      });
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const grade = async (period: Period, isCorrect: boolean) => {
    if (!session) return;
    const point = isCorrect
      ? Number(points[period.id] ?? session.suggestedCorrectPoint) || 0
      : session.suggestedWrongPoint;
    setBusy(period.id);
    try {
      await questionBankHttp.put(`/question-bank/grading/periods/${period.id}`, {
        isCorrect,
        point,
      });
      toast.success(`Q${period.number} marked ${isCorrect ? 'correct' : 'wrong'}.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to grade the answer');
    } finally {
      setBusy(null);
    }
  };

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
          <p className="text-sm font-medium text-foreground">Session not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/question-bank/grading')}>
            <ArrowLeft className="size-4" />
            Back to grading
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
          onClick={() => router.push('/question-bank/grading')}
        >
          <ArrowLeft className="size-4" />
          Grading queue
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
            {pendingShort} to grade
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
              </ul>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      Student's answer
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
                {p.studentAnswer && p.studentAnswer.trim() ? (
                  <div className="flex flex-wrap items-end gap-2 border-t pt-3">
                    <div>
                      <Label className="mb-1 text-xs text-muted-foreground">Points</Label>
                      <Input
                        type="number"
                        className="h-9 w-24"
                        value={points[p.id] ?? ''}
                        onChange={(e) => setPoints((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={busy === p.id}
                      onClick={() => grade(p, true)}
                    >
                      <Check className="size-4" />
                      Mark correct
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={busy === p.id}
                      onClick={() => grade(p, false)}
                    >
                      <X className="size-4" />
                      Mark wrong ({session.suggestedWrongPoint})
                    </Button>
                  </div>
                ) : (
                  <p className="border-t pt-3 text-xs text-muted-foreground">
                    Left blank — scores 0, nothing to grade.
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
