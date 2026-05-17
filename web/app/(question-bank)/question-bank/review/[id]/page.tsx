'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2, RotateCcw, X } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const TEXTAREA_CLS =
  'flex min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

const NONE = '__none__';
const LEVELS = ['easy', 'medium', 'hard'];
const COGNITIVE = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  submitted: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
};

interface LoadedQuestion {
  id: string;
  compId: string;
  code: string;
  writerName: string | null;
  status: string;
  type: string;
  level: string | null;
  cognitive: string | null;
  grades: string[];
  content: string;
  explanation: string | null;
  isBonus: boolean;
  answers: { content: string; isCorrect: boolean }[];
  topics: { topicId: string; subtopicId: string | null }[];
}
interface Proofread {
  id: string;
  reviewerName: string | null;
  level: string | null;
  cognitive: string | null;
  comment: string | null;
  doneAt: string | null;
  createdAt: string;
}
interface TaxItem {
  id: string;
  name: string;
  parentId?: string;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ReviewQuestionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [question, setQuestion] = useState<LoadedQuestion | null>(null);
  const [proofreads, setProofreads] = useState<Proofread[]>([]);
  const [subjects, setSubjects] = useState<TaxItem[]>([]);
  const [topics, setTopics] = useState<TaxItem[]>([]);
  const [subtopics, setSubtopics] = useState<TaxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [comment, setComment] = useState('');
  const [level, setLevel] = useState(NONE);
  const [cognitive, setCognitive] = useState(NONE);
  const [busy, setBusy] = useState<'approve' | 'send-back' | null>(null);

  useEffect(() => {
    setLoading(true);
    questionBankHttp
      .get<LoadedQuestion>(`/question-bank/questions/${id}`)
      .then(async (q) => {
        setQuestion(q);
        const cq = encodeURIComponent(q.compId);
        const [pr, s, t, st] = await Promise.all([
          questionBankHttp.get<Proofread[]>(`/question-bank/questions/${id}/proofreads`),
          questionBankHttp.get<TaxItem[]>(`/question-bank/subjects?compId=${cq}`),
          questionBankHttp.get<TaxItem[]>(`/question-bank/topics?compId=${cq}`),
          questionBankHttp.get<TaxItem[]>(`/question-bank/subtopics?compId=${cq}`),
        ]);
        setProofreads(pr);
        setSubjects(s);
        setTopics(t);
        setSubtopics(st);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const subtopicById = useMemo(() => new Map(subtopics.map((s) => [s.id, s])), [subtopics]);

  const act = async (kind: 'approve' | 'send-back') => {
    if (kind === 'send-back' && !comment.trim()) {
      toast.error('A comment is required to send a question back.');
      return;
    }
    setBusy(kind);
    try {
      await questionBankHttp.post(`/question-bank/questions/${id}/${kind}`, {
        comment: comment.trim() || undefined,
        level: level === NONE ? undefined : level,
        cognitive: cognitive === NONE ? undefined : cognitive,
      });
      toast.success(kind === 'approve' ? 'Question approved.' : 'Question sent back to draft.');
      router.push('/question-bank/review');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
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

  if (notFound || !question) {
    return (
      <div className="mx-auto max-w-[900px] space-y-6 p-6 lg:p-8">
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">Question not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/question-bank/review')}>
            <ArrowLeft className="size-4" />
            Back to review queue
          </Button>
        </Card>
      </div>
    );
  }

  const isMC = question.type !== 'short_answer';
  const reviewable = question.status === 'submitted';

  return (
    <div className="mx-auto max-w-[900px] space-y-6 p-6 lg:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 text-muted-foreground"
          onClick={() => router.push('/question-bank/review')}
        >
          <ArrowLeft className="size-4" />
          Review queue
        </Button>
        <PageHeader
          eyebrow="Question Bank · Review"
          title={question.code}
          subtitle={question.writerName ? `Written by ${question.writerName}` : undefined}
          actions={
            <Badge
              variant="outline"
              className={cn(
                'border-transparent font-mono text-[10px] capitalize',
                STATUS_STYLE[question.status] ?? 'bg-muted text-muted-foreground',
              )}
            >
              {question.status}
            </Badge>
          }
        />
      </div>

      {!reviewable && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          This question is {question.status} — there is nothing to review. Only submitted questions
          can be approved or sent back.
        </div>
      )}

      {/* The question */}
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">
            {isMC ? 'Multiple choice' : 'Short answer'}
          </Badge>
          {question.isBonus && (
            <Badge variant="outline" className="font-mono text-[10px]">
              Bonus
            </Badge>
          )}
          {question.level && (
            <Badge variant="outline" className="font-mono text-[10px] capitalize">
              {question.level}
            </Badge>
          )}
          {question.cognitive && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {question.cognitive}
            </Badge>
          )}
          {question.grades.map((g) => (
            <Badge key={g} variant="outline" className="font-mono text-[10px]">
              {g}
            </Badge>
          ))}
        </div>

        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
          {question.content}
        </p>

        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {isMC ? 'Answer options' : 'Answer key'}
          </p>
          <ul className="space-y-1.5">
            {question.answers.map((a, i) => (
              <li
                key={i}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                  a.isCorrect
                    ? 'border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'bg-card',
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full',
                    a.isCorrect ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {a.isCorrect ? <Check className="size-3.5" /> : <X className="size-3" />}
                </span>
                <span className="text-foreground">{a.content}</span>
              </li>
            ))}
          </ul>
        </div>

        {question.explanation && (
          <div>
            <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Explanation
            </p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {question.explanation}
            </p>
          </div>
        )}

        {question.topics.length > 0 && (
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Topic tags
            </p>
            <ul className="flex flex-wrap gap-2">
              {question.topics.map((t) => {
                const topic = topicById.get(t.topicId);
                const subject = topic?.parentId ? subjectById.get(topic.parentId) : undefined;
                const subtopic = t.subtopicId ? subtopicById.get(t.subtopicId) : undefined;
                return (
                  <li
                    key={t.topicId}
                    className="rounded-md border bg-card px-2.5 py-1.5 text-xs text-foreground"
                  >
                    {subject?.name ? `${subject.name} › ` : ''}
                    {topic?.name ?? t.topicId}
                    {subtopic?.name ? ` › ${subtopic.name}` : ''}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>

      {/* Proofread history */}
      {proofreads.length > 0 && (
        <Card className="space-y-3 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Review history
          </p>
          <ul className="space-y-3">
            {proofreads.map((p) => (
              <li key={p.id} className="border-l-2 border-border pl-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{p.reviewerName ?? 'Reviewer'}</span>
                  <span>·</span>
                  <span className="font-mono">{fmtDate(p.createdAt)}</span>
                  {p.level && <Badge variant="outline" className="font-mono text-[10px] capitalize">{p.level}</Badge>}
                  {p.cognitive && <Badge variant="outline" className="font-mono text-[10px]">{p.cognitive}</Badge>}
                </div>
                {p.comment && <p className="mt-1 text-sm text-foreground">{p.comment}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Review actions */}
      {reviewable && (
        <Card className="space-y-4 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Your review
          </p>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">
              Comment{' '}
              <span className="font-normal">(required to send back, optional to approve)</span>
            </Label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Notes for the author…"
              className={TEXTAREA_CLS}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Difficulty assessment <span className="font-normal">(optional)</span>
              </Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not assessed</SelectItem>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l} className="capitalize">
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Cognitive assessment <span className="font-normal">(optional)</span>
              </Label>
              <Select value={cognitive} onValueChange={setCognitive}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not assessed</SelectItem>
                  {COGNITIVE.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={!!busy || !comment.trim()}
              onClick={() => act('send-back')}
            >
              <RotateCcw className="size-4" />
              {busy === 'send-back' ? 'Sending back…' : 'Send back to draft'}
            </Button>
            <Button disabled={!!busy} onClick={() => act('approve')}>
              <Check className="size-4" />
              {busy === 'approve' ? 'Approving…' : 'Approve question'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
