'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { useQuestionBank } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  'flex min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';

const NONE = '__none__';
const LEVELS = ['easy', 'medium', 'hard'];
const COGNITIVE = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
const GRADE_OPTIONS = ['SD', 'SMP', 'SMA'];

interface Answer {
  content: string;
  isCorrect: boolean;
}
interface TopicTag {
  topicId: string;
  subtopicId: string | null;
}
interface TaxItem {
  id: string;
  name: string;
  parentId?: string;
}
interface LoadedQuestion {
  id: string;
  compId: string;
  code: string;
  writerId: string;
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

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  submitted: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
};

export default function QuestionEditorPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const { selectedId } = useQuestionBank();

  const [loaded, setLoaded] = useState<LoadedQuestion | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);

  // Form state.
  const [type, setType] = useState<'multiple_choice' | 'short_answer'>('multiple_choice');
  const [content, setContent] = useState('');
  const [level, setLevel] = useState(NONE);
  const [cognitive, setCognitive] = useState(NONE);
  const [grades, setGrades] = useState<string[]>([]);
  const [isBonus, setIsBonus] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [mcAnswers, setMcAnswers] = useState<Answer[]>([
    { content: '', isCorrect: false },
    { content: '', isCorrect: false },
  ]);
  const [saAnswer, setSaAnswer] = useState('');
  const [tags, setTags] = useState<TopicTag[]>([]);

  // Taxonomy (whole competition — used by the tag builder + tag labels).
  const [subjects, setSubjects] = useState<TaxItem[]>([]);
  const [topics, setTopics] = useState<TaxItem[]>([]);
  const [subtopics, setSubtopics] = useState<TaxItem[]>([]);

  // Tag builder.
  const [tagSubject, setTagSubject] = useState('');
  const [tagTopic, setTagTopic] = useState('');
  const [tagSubtopic, setTagSubtopic] = useState(NONE);

  const [saving, setSaving] = useState(false);

  const compId = isNew ? selectedId : loaded?.compId ?? '';
  // Only draft questions are editable — once submitted/approved a question is
  // locked here; send it back from the review screen to edit it again.
  const readOnly = !isNew && !!loaded && loaded.status !== 'draft';

  // Load the question (edit mode).
  useEffect(() => {
    if (isNew) return;
    setLoadingQuestion(true);
    questionBankHttp
      .get<LoadedQuestion>(`/question-bank/questions/${id}`)
      .then((q) => {
        setLoaded(q);
        setType(q.type === 'short_answer' ? 'short_answer' : 'multiple_choice');
        setContent(q.content ?? '');
        setLevel(q.level || NONE);
        setCognitive(q.cognitive || NONE);
        setGrades(q.grades ?? []);
        setIsBonus(q.isBonus);
        setExplanation(q.explanation ?? '');
        if (q.type === 'short_answer') {
          setSaAnswer(q.answers[0]?.content ?? '');
        } else if (q.answers.length > 0) {
          setMcAnswers(q.answers.map((a) => ({ content: a.content, isCorrect: a.isCorrect })));
        }
        setTags(q.topics.map((t) => ({ topicId: t.topicId, subtopicId: t.subtopicId })));
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingQuestion(false));
  }, [id, isNew]);

  // Load the taxonomy once the competition is known.
  useEffect(() => {
    if (!compId) return;
    const q = `compId=${encodeURIComponent(compId)}`;
    Promise.all([
      questionBankHttp.get<TaxItem[]>(`/question-bank/subjects?${q}`),
      questionBankHttp.get<TaxItem[]>(`/question-bank/topics?${q}`),
      questionBankHttp.get<TaxItem[]>(`/question-bank/subtopics?${q}`),
    ])
      .then(([s, t, st]) => {
        setSubjects(s);
        setTopics(t);
        setSubtopics(st);
      })
      .catch(() => {
        setSubjects([]);
        setTopics([]);
        setSubtopics([]);
      });
  }, [compId]);

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const subtopicById = useMemo(() => new Map(subtopics.map((s) => [s.id, s])), [subtopics]);

  const builderTopics = topics.filter((t) => t.parentId === tagSubject);
  const builderSubtopics = subtopics.filter((s) => s.parentId === tagTopic);

  const toggleGrade = (g: string) =>
    setGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const addTag = () => {
    if (!tagTopic) return;
    if (tags.some((t) => t.topicId === tagTopic)) {
      toast.info('That topic is already tagged.');
      return;
    }
    setTags((prev) => [
      ...prev,
      { topicId: tagTopic, subtopicId: tagSubtopic === NONE ? null : tagSubtopic },
    ]);
    setTagSubject('');
    setTagTopic('');
    setTagSubtopic(NONE);
  };

  const validate = (): string | null => {
    if (!compId) return 'No competition selected.';
    if (!content.trim()) return 'The question content is required.';
    if (type === 'multiple_choice') {
      const filled = mcAnswers.filter((a) => a.content.trim());
      if (filled.length < 2) return 'A multiple-choice question needs at least 2 options.';
      if (!filled.some((a) => a.isCorrect)) return 'Mark at least one option as correct.';
    } else if (!saAnswer.trim()) {
      return 'The answer key is required.';
    }
    return null;
  };

  const buildPayload = () => ({
    compId,
    type,
    content: content.trim(),
    level: level === NONE ? null : level,
    cognitive: cognitive === NONE ? null : cognitive,
    grades,
    isBonus,
    explanation: explanation.trim() || null,
    answers:
      type === 'multiple_choice'
        ? mcAnswers
            .filter((a) => a.content.trim())
            .map((a) => ({ content: a.content.trim(), isCorrect: a.isCorrect }))
        : [{ content: saAnswer.trim(), isCorrect: true }],
    topics: tags,
  });

  const save = async (thenSubmit: boolean) => {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      const result = isNew
        ? await questionBankHttp.post<LoadedQuestion>('/question-bank/questions', payload)
        : await questionBankHttp.put<LoadedQuestion>(`/question-bank/questions/${id}`, payload);
      if (thenSubmit) {
        await questionBankHttp.post(`/question-bank/questions/${result.id}/submit`, {});
        toast.success(`${result.code} submitted for review.`);
      } else {
        toast.success(isNew ? `${result.code} created.` : `${result.code} saved.`);
      }
      router.push('/question-bank/questions');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save the question');
    } finally {
      setSaving(false);
    }
  };

  if (loadingQuestion) {
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
          <p className="text-sm font-medium text-foreground">Question not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/question-bank/questions')}>
            <ArrowLeft className="size-4" />
            Back to questions
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-6 p-6 lg:p-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 text-muted-foreground"
          onClick={() => router.push('/question-bank/questions')}
        >
          <ArrowLeft className="size-4" />
          Questions
        </Button>
        <PageHeader
          eyebrow="Question Bank"
          title={isNew ? 'New question' : loaded?.code ?? 'Question'}
          subtitle={
            isNew
              ? 'Author a question, then save it as a draft or submit it for review.'
              : 'Edit this draft question.'
          }
          actions={
            loaded && (
              <Badge
                variant="outline"
                className={cn(
                  'border-transparent font-mono text-[10px] capitalize',
                  STATUS_STYLE[loaded.status] ?? 'bg-muted text-muted-foreground',
                )}
              >
                {loaded.status}
              </Badge>
            )
          }
        />
      </div>

      {readOnly && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          This question is {loaded?.status} and is read-only. Send it back from the review screen
          to edit it again.
        </div>
      )}

      <fieldset disabled={readOnly || saving} className="space-y-6">
        {/* Type + content */}
        <Card className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                  <SelectItem value="short_answer">Short answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isBonus}
                  onChange={(e) => setIsBonus(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Bonus question
              </label>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">
              Question content <span className="text-destructive">*</span>
            </Label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type the question…"
              className={TEXTAREA_CLS}
            />
          </div>
        </Card>

        {/* Answers */}
        <Card className="space-y-4 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {type === 'multiple_choice' ? 'Answer options' : 'Answer key'}
          </p>
          {type === 'multiple_choice' ? (
            <div className="space-y-2">
              {mcAnswers.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={a.content}
                    placeholder={`Option ${i + 1}`}
                    onChange={(e) =>
                      setMcAnswers((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)),
                      )
                    }
                  />
                  <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={a.isCorrect}
                      onChange={(e) =>
                        setMcAnswers((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, isCorrect: e.target.checked } : x)),
                        )
                      }
                      className="size-4 accent-primary"
                    />
                    Correct
                  </label>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Remove option"
                    disabled={mcAnswers.length <= 2}
                    onClick={() => setMcAnswers((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={mcAnswers.length >= 8}
                onClick={() => setMcAnswers((prev) => [...prev, { content: '', isCorrect: false }])}
              >
                <Plus className="size-4" />
                Add option
              </Button>
            </div>
          ) : (
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Correct answer <span className="text-destructive">*</span>
              </Label>
              <Input
                value={saAnswer}
                onChange={(e) => setSaAnswer(e.target.value)}
                placeholder="The expected answer"
              />
            </div>
          )}
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Explanation</Label>
            <textarea
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Optional — shown after the question is answered."
              className={TEXTAREA_CLS}
            />
          </div>
        </Card>

        {/* Metadata */}
        <Card className="space-y-4 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Classification
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Difficulty level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l} className="capitalize">
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Cognitive level</Label>
              <Select value={cognitive} onValueChange={setCognitive}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {COGNITIVE.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        </Card>

        {/* Topic tagging */}
        <Card className="space-y-4 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Topic tags
          </p>
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {tags.map((t) => {
                const topic = topicById.get(t.topicId);
                const subject = topic?.parentId ? subjectById.get(topic.parentId) : undefined;
                const subtopic = t.subtopicId ? subtopicById.get(t.subtopicId) : undefined;
                return (
                  <li
                    key={t.topicId}
                    className="flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-foreground">
                      {subject?.name ? `${subject.name} › ` : ''}
                      {topic?.name ?? t.topicId}
                      {subtopic?.name ? ` › ${subtopic.name}` : ''}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove tag"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setTags((prev) => prev.filter((x) => x.topicId !== t.topicId))}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Select
              value={tagSubject || undefined}
              onValueChange={(v) => {
                setTagSubject(v);
                setTagTopic('');
                setTagSubtopic(NONE);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={tagTopic || undefined}
              onValueChange={(v) => {
                setTagTopic(v);
                setTagSubtopic(NONE);
              }}
            >
              <SelectTrigger className="w-full" disabled={!tagSubject}>
                <SelectValue placeholder="Topic" />
              </SelectTrigger>
              <SelectContent>
                {builderTopics.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tagSubtopic} onValueChange={setTagSubtopic}>
              <SelectTrigger className="w-full" disabled={!tagTopic}>
                <SelectValue placeholder="Subtopic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No subtopic</SelectItem>
                {builderSubtopics.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" disabled={!tagTopic} onClick={addTag}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>
          {subjects.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No taxonomy yet — add subjects and topics on the Taxonomy page first.
            </p>
          )}
        </Card>
      </fieldset>

      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => router.push('/question-bank/questions')}>
            Cancel
          </Button>
          <Button variant="outline" disabled={saving} onClick={() => save(false)}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button disabled={saving} onClick={() => save(true)}>
            <Send className="size-4" />
            Save &amp; submit for review
          </Button>
        </div>
      )}
    </div>
  );
}
