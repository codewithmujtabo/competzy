'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save, Search } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { useQuestionBank } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TEXTAREA_CLS =
  'flex min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60';
const GRADE_OPTIONS = ['SD', 'SMP', 'SMA'];

interface ExamQuestion {
  id: string;
  code: string;
  type: string;
  content: string;
  status: string;
  grades: string[];
}
interface LoadedExam {
  id: string;
  compId: string;
  name: string;
  code: string;
  year: number | null;
  date: string | null;
  grades: string[];
  choice: boolean;
  short: boolean;
  startTime: string | null;
  endTime: string | null;
  minutes: number | null;
  correctScore: Record<string, number>;
  wrongScore: Record<string, number>;
  description: string | null;
  questions: ExamQuestion[];
}

export default function ExamEditorPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const { selectedId } = useQuestionBank();

  const [loading, setLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [exam, setExam] = useState<LoadedExam | null>(null);

  // Blueprint form state.
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [year, setYear] = useState('');
  const [date, setDate] = useState('');
  const [grades, setGrades] = useState<string[]>([]);
  const [choice, setChoice] = useState(true);
  const [short, setShort] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const [correctScore, setCorrectScore] = useState<Record<string, string>>({});
  const [wrongScore, setWrongScore] = useState<Record<string, string>>({});
  const [savingBlueprint, setSavingBlueprint] = useState(false);

  // Question picker state.
  const [pool, setPool] = useState<ExamQuestion[]>([]);
  const [attached, setAttached] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [savingQuestions, setSavingQuestions] = useState(false);

  const compId = isNew ? selectedId : exam?.compId ?? '';

  const populate = (e: LoadedExam) => {
    setExam(e);
    setName(e.name);
    setCode(e.code);
    setYear(e.year != null ? String(e.year) : '');
    setDate(e.date ? e.date.slice(0, 10) : '');
    setGrades(e.grades);
    setChoice(e.choice);
    setShort(e.short);
    setMinutes(e.minutes != null ? String(e.minutes) : '');
    setStartTime(e.startTime ? e.startTime.slice(0, 5) : '');
    setEndTime(e.endTime ? e.endTime.slice(0, 5) : '');
    setDescription(e.description ?? '');
    setCorrectScore(Object.fromEntries(Object.entries(e.correctScore).map(([k, v]) => [k, String(v)])));
    setWrongScore(Object.fromEntries(Object.entries(e.wrongScore).map(([k, v]) => [k, String(v)])));
    setAttached(new Set(e.questions.map((q) => q.id)));
  };

  // Load the exam (edit mode).
  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    questionBankHttp
      .get<LoadedExam>(`/question-bank/exams/${id}`)
      .then(populate)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Load the approved-question pool once the competition is known.
  useEffect(() => {
    if (!compId) return;
    questionBankHttp
      .get<ExamQuestion[]>(`/question-bank/questions?compId=${encodeURIComponent(compId)}&status=approved`)
      .then(setPool)
      .catch(() => setPool([]));
  }, [compId]);

  const toggleGrade = (g: string) =>
    setGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  const toggleAttached = (qid: string) =>
    setAttached((prev) => {
      const next = new Set(prev);
      next.has(qid) ? next.delete(qid) : next.add(qid);
      return next;
    });

  const buildPayload = () => ({
    compId,
    name: name.trim(),
    code: code.trim(),
    year: year.trim() ? Number(year) : null,
    date: date || null,
    grades,
    choice,
    short,
    minutes: minutes.trim() ? Number(minutes) : null,
    startTime: startTime || null,
    endTime: endTime || null,
    description: description.trim() || null,
    correctScore: Object.fromEntries(grades.map((g) => [g, Number(correctScore[g] ?? 0) || 0])),
    wrongScore: Object.fromEntries(grades.map((g) => [g, Number(wrongScore[g] ?? 0) || 0])),
  });

  const saveBlueprint = async () => {
    if (!name.trim() || !code.trim()) {
      toast.error('Name and code are required.');
      return;
    }
    setSavingBlueprint(true);
    try {
      if (isNew) {
        const created = await questionBankHttp.post<LoadedExam>(
          '/question-bank/exams',
          buildPayload(),
        );
        toast.success(`${created.code} created.`);
        router.push(`/question-bank/exams/${created.id}`);
      } else {
        const updated = await questionBankHttp.put<LoadedExam>(
          `/question-bank/exams/${id}`,
          buildPayload(),
        );
        populate(updated);
        toast.success('Exam saved.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save the exam');
    } finally {
      setSavingBlueprint(false);
    }
  };

  const saveQuestions = async () => {
    setSavingQuestions(true);
    try {
      await questionBankHttp.put(`/question-bank/exams/${id}/questions`, {
        questionIds: [...attached],
      });
      toast.success('Question set saved.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save the question set');
    } finally {
      setSavingQuestions(false);
    }
  };

  const filteredPool = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return pool;
    return pool.filter(
      (q) => q.code.toLowerCase().includes(f) || q.content.toLowerCase().includes(f),
    );
  }, [pool, filter]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-[900px] space-y-6 p-6 lg:p-8">
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">Exam not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/question-bank/exams')}>
            <ArrowLeft className="size-4" />
            Back to exams
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 p-6 lg:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 text-muted-foreground"
          onClick={() => router.push('/question-bank/exams')}
        >
          <ArrowLeft className="size-4" />
          Exams
        </Button>
        <PageHeader
          eyebrow="Question Bank"
          title={isNew ? 'New exam' : exam?.code ?? 'Exam'}
          subtitle={
            isNew
              ? 'Define the exam, then attach approved questions.'
              : 'Edit the blueprint and the question set.'
          }
        />
      </div>

      {/* Blueprint */}
      <Card className="space-y-4 p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Blueprint
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="EMC Round 1" />
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">
              Code <span className="text-destructive">*</span>
            </Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EX-R1" />
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Year</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2026"
            />
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Exam date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Start time</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">End time</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Duration (minutes)</Label>
            <Input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="90"
            />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 text-xs text-muted-foreground">Grades</Label>
          <div className="flex flex-wrap gap-2">
            {GRADE_OPTIONS.map((g) => (
              <label
                key={g}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={grades.includes(g)}
                  onChange={() => toggleGrade(g)}
                  className="size-4 accent-primary"
                />
                {g}
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={choice}
              onChange={(e) => setChoice(e.target.checked)}
              className="size-4 accent-primary"
            />
            Has multiple-choice questions
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={short}
              onChange={(e) => setShort(e.target.checked)}
              className="size-4 accent-primary"
            />
            Has short-answer questions
          </label>
        </div>
        <div>
          <Label className="mb-1.5 text-xs text-muted-foreground">Description</Label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — instructions shown to students."
            className={TEXTAREA_CLS}
          />
        </div>
      </Card>

      {/* Per-grade scoring */}
      {grades.length > 0 && (
        <Card className="space-y-3 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Scoring per grade
          </p>
          <p className="text-xs text-muted-foreground">
            Points awarded per correct answer and per wrong answer (use a negative value for a
            penalty). Blank answers always score 0.
          </p>
          <div className="space-y-2">
            {grades.map((g) => (
              <div key={g} className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="w-14 justify-center font-mono text-[11px]">
                  {g}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Correct</Label>
                  <Input
                    type="number"
                    className="h-8 w-24"
                    value={correctScore[g] ?? ''}
                    onChange={(e) => setCorrectScore((p) => ({ ...p, [g]: e.target.value }))}
                    placeholder="4"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Wrong</Label>
                  <Input
                    type="number"
                    className="h-8 w-24"
                    value={wrongScore[g] ?? ''}
                    onChange={(e) => setWrongScore((p) => ({ ...p, [g]: e.target.value }))}
                    placeholder="-1"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push('/question-bank/exams')}>
          Cancel
        </Button>
        <Button onClick={saveBlueprint} disabled={savingBlueprint}>
          <Save className="size-4" />
          {savingBlueprint ? 'Saving…' : isNew ? 'Create exam' : 'Save changes'}
        </Button>
      </div>

      {/* Question set — edit mode only */}
      {!isNew && (
        <Card className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Question set
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {attached.size} of {pool.length} approved questions selected.
              </p>
            </div>
            <Button onClick={saveQuestions} disabled={savingQuestions}>
              <Save className="size-4" />
              {savingQuestions ? 'Saving…' : 'Save question set'}
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Filter by code or content…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          {pool.length === 0 ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
              No approved questions in this competition yet. Approve questions on the Review screen
              first.
            </p>
          ) : (
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {filteredPool.map((q) => (
                <li key={q.id}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-card px-3 py-2 transition-colors hover:bg-accent">
                    <input
                      type="checkbox"
                      checked={attached.has(q.id)}
                      onChange={() => toggleAttached(q.id)}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{q.code}</span>
                        <Badge variant="outline" className="font-mono text-[9px]">
                          {q.type === 'short_answer' ? 'Short' : 'MC'}
                        </Badge>
                        {q.grades.map((g) => (
                          <Badge key={g} variant="outline" className="font-mono text-[9px]">
                            {g}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-foreground">{q.content}</p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
