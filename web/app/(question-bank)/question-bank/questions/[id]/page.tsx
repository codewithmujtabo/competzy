'use client';

// Multi-language question editor (Komodo-parity).
//
// One language is "active" at a time across the whole question — a tab
// strip at the top of the editor card picks which `content*` column the
// stem editor, every MC answer's editor, and the SA answer-key input write
// into. That keeps one TipTap instance per slot (heavy) instead of six
// per slot, and matches Komodo's authoring UX where the author dwells in
// one language at a time before switching.

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Loader2, Plus, Send, Trash2, X } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { useQuestionBank } from '@/lib/question-bank/context';
import {
  LANGS,
  LANG_COLS,
  LANG_TO_COL,
  emptyLangs,
  readLangs,
  type LangCol,
  type LangCode,
} from '@/lib/question-bank/languages';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// Dynamic-imported so the ~120 KB TipTap + KaTeX bundle only ships on pages
// that actually mount the editor. SSR off — Tiptap manipulates the DOM and
// renders nothing useful on the server.
const RichTextEditor = dynamic(
  () => import('@/components/editor/rich-text-editor').then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="min-h-[140px] rounded-md border border-input bg-background" /> },
);

const NONE = '__none__';
const LEVELS = ['easy', 'medium', 'hard'];
const COGNITIVE = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));

interface McAnswer {
  contents: Record<LangCol, string>;
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
  content2: string;
  content3: string;
  content4: string;
  content5: string;
  content6: string;
  explanation: string | null;
  isBonus: boolean;
  tags: string[];
  answers: ({
    content: string;
    content2: string;
    content3: string;
    content4: string;
    content5: string;
    content6: string;
    isCorrect: boolean;
  })[];
  topics: { topicId: string; subtopicId: string | null }[];
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  submitted: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
};

function newMcAnswer(): McAnswer {
  return { contents: emptyLangs(), isCorrect: false };
}

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
  const [contents, setContents] = useState<Record<LangCol, string>>(emptyLangs);
  const [level, setLevel] = useState(NONE);
  const [cognitive, setCognitive] = useState(NONE);
  const [grades, setGrades] = useState<string[]>([]);
  const [isBonus, setIsBonus] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [mcAnswers, setMcAnswers] = useState<McAnswer[]>([newMcAnswer(), newMcAnswer()]);
  const [saAnswers, setSaAnswers] = useState<Record<LangCol, string>>(emptyLangs);
  const [questionTags, setQuestionTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [topicTags, setTopicTags] = useState<TopicTag[]>([]);

  // Active-language tab — applies to the stem AND every answer cell so the
  // author dwells in one language at a time. Defaults to English.
  const [activeLang, setActiveLang] = useState<LangCode>('en');
  const activeCol = LANG_TO_COL[activeLang];

  // Taxonomy (whole competition — used by the tag builder + tag labels).
  const [subjects, setSubjects] = useState<TaxItem[]>([]);
  const [topics, setTopics] = useState<TaxItem[]>([]);
  const [subtopics, setSubtopics] = useState<TaxItem[]>([]);

  // Topic-tag builder.
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
        setContents(readLangs(q));
        setLevel(q.level || NONE);
        setCognitive(q.cognitive || NONE);
        setGrades(q.grades ?? []);
        setIsBonus(q.isBonus);
        setExplanation(q.explanation ?? '');
        setQuestionTags(Array.isArray(q.tags) ? q.tags : []);
        if (q.type === 'short_answer') {
          setSaAnswers(readLangs(q.answers[0] ?? null));
        } else if (q.answers.length > 0) {
          setMcAnswers(
            q.answers.map((a) => ({
              contents: readLangs(a),
              isCorrect: a.isCorrect,
            })),
          );
        }
        setTopicTags(q.topics.map((t) => ({ topicId: t.topicId, subtopicId: t.subtopicId })));
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

  const setStem = (col: LangCol, v: string) =>
    setContents((prev) => ({ ...prev, [col]: v }));

  const setMcAnswerContent = (i: number, col: LangCol, v: string) =>
    setMcAnswers((prev) =>
      prev.map((a, j) => (j === i ? { ...a, contents: { ...a.contents, [col]: v } } : a)),
    );

  const setSa = (col: LangCol, v: string) =>
    setSaAnswers((prev) => ({ ...prev, [col]: v }));

  // Copy English content into the currently active non-English tab.
  const copyEnglishToActive = () => {
    if (activeCol === 'content') return;
    setStem(activeCol, contents.content);
    setMcAnswers((prev) =>
      prev.map((a) => ({ ...a, contents: { ...a.contents, [activeCol]: a.contents.content } })),
    );
    setSaAnswers((prev) => ({ ...prev, [activeCol]: prev.content }));
    toast.success(`Copied English into ${LANGS.find((l) => l.code === activeLang)?.label}.`);
  };

  const addTopicTag = () => {
    if (!tagTopic) return;
    if (topicTags.some((t) => t.topicId === tagTopic)) {
      toast.info('That topic is already tagged.');
      return;
    }
    setTopicTags((prev) => [
      ...prev,
      { topicId: tagTopic, subtopicId: tagSubtopic === NONE ? null : tagSubtopic },
    ]);
    setTagSubject('');
    setTagTopic('');
    setTagSubtopic(NONE);
  };

  const addQuestionTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setQuestionTags((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setTagInput('');
  };

  const removeQuestionTag = (t: string) =>
    setQuestionTags((prev) => prev.filter((x) => x !== t));

  const validate = (): string | null => {
    if (!compId) return 'No competition selected.';
    if (!contents.content.trim()) return 'The English question content is required.';
    if (type === 'multiple_choice') {
      const filled = mcAnswers.filter((a) => a.contents.content.trim());
      if (filled.length < 2) return 'A multiple-choice question needs at least 2 options.';
      if (!filled.some((a) => a.isCorrect)) return 'Mark at least one option as correct.';
    } else if (!saAnswers.content.trim()) {
      return 'The English answer key is required.';
    }
    return null;
  };

  const buildPayload = () => ({
    compId,
    type,
    // Spread all 6 language columns at top level (the backend reads them
    // via readLangContents).
    content: contents.content.trim(),
    content2: contents.content2.trim(),
    content3: contents.content3.trim(),
    content4: contents.content4.trim(),
    content5: contents.content5.trim(),
    content6: contents.content6.trim(),
    level: level === NONE ? null : level,
    cognitive: cognitive === NONE ? null : cognitive,
    grades,
    isBonus,
    explanation: explanation.trim() || null,
    tags: questionTags,
    answers:
      type === 'multiple_choice'
        ? mcAnswers
            .filter((a) => a.contents.content.trim())
            .map((a) => ({
              ...Object.fromEntries(LANG_COLS.map((c) => [c, a.contents[c].trim()])),
              isCorrect: a.isCorrect,
            }))
        : [
            {
              ...Object.fromEntries(LANG_COLS.map((c) => [c, saAnswers[c].trim()])),
              isCorrect: true,
            },
          ],
    topics: topicTags,
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
              ? 'Author a question in up to 6 languages, then save it as a draft or submit it for review.'
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
        {/* Type + content (with the 6-language tab strip) */}
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

          {/* Language tab strip — applies to stem + each MC answer + SA key. */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Language</Label>
              {activeLang !== 'en' && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="-mr-2 h-7 text-xs"
                  onClick={copyEnglishToActive}
                  title="Copy English content into this tab"
                >
                  <Copy className="size-3.5" />
                  Copy from English
                </Button>
              )}
            </div>
            <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as LangCode)}>
              <TabsList className="w-full flex-wrap justify-start">
                {LANGS.map((l) => {
                  const filled = !!contents[l.col]?.trim();
                  return (
                    <TabsTrigger
                      key={l.code}
                      value={l.code}
                      className="data-[state=active]:text-foreground"
                    >
                      {l.label}
                      {filled && l.code !== 'en' && (
                        <span className="ml-1 size-1.5 rounded-full bg-emerald-500" aria-hidden />
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>

          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">
              Question content{' '}
              {activeLang === 'en' && <span className="text-destructive">*</span>}
              <span className="ml-1 text-muted-foreground/60">
                ({LANGS.find((l) => l.code === activeLang)?.label})
              </span>
            </Label>
            <RichTextEditor
              value={contents[activeCol]}
              onChange={(v) => setStem(activeCol, v)}
              placeholder={
                activeLang === 'en'
                  ? 'Type the question — supports inline math via the Σ button.'
                  : 'Optional translation. Leave empty to fall back to English at exam time.'
              }
              minHeight="min-h-[160px]"
            />
          </div>
        </Card>

        {/* Answers + Explanation */}
        <Card className="space-y-4 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {type === 'multiple_choice' ? 'Answer options' : 'Answer key'}{' '}
            <span className="text-muted-foreground/70">
              · {LANGS.find((l) => l.code === activeLang)?.label}
            </span>
          </p>
          {type === 'multiple_choice' ? (
            <div className="space-y-3">
              {mcAnswers.map((a, i) => (
                <div key={i} className="rounded-lg border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Option {i + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={a.isCorrect}
                          onChange={(e) =>
                            setMcAnswers((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, isCorrect: e.target.checked } : x,
                              ),
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
                        className="size-7 text-muted-foreground hover:text-destructive"
                        aria-label="Remove option"
                        disabled={mcAnswers.length <= 2}
                        onClick={() => setMcAnswers((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <RichTextEditor
                    value={a.contents[activeCol]}
                    onChange={(v) => setMcAnswerContent(i, activeCol, v)}
                    placeholder={
                      activeLang === 'en' ? 'Option text — math allowed.' : 'Optional translation.'
                    }
                    minHeight="min-h-[60px]"
                  />
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={mcAnswers.length >= 8}
                onClick={() => setMcAnswers((prev) => [...prev, newMcAnswer()])}
              >
                <Plus className="size-4" />
                Add option
              </Button>
            </div>
          ) : (
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Correct answer{' '}
                {activeLang === 'en' && <span className="text-destructive">*</span>}
              </Label>
              <Input
                value={saAnswers[activeCol]}
                onChange={(e) => setSa(activeCol, e.target.value)}
                placeholder={
                  activeLang === 'en' ? 'The expected answer' : 'Optional translation'
                }
              />
            </div>
          )}
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Explanation</Label>
            <RichTextEditor
              value={explanation}
              onChange={setExplanation}
              placeholder="Optional — shown after the question is answered. Supports inline math via the Σ button."
              minHeight="min-h-[100px]"
            />
          </div>
        </Card>

        {/* Tags */}
        <Card className="space-y-4 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Tags
          </p>
          <p className="text-xs text-muted-foreground">
            Free-text labels for filtering — e.g. <code className="font-mono">geometry</code>,{' '}
            <code className="font-mono">aops-2018</code>, <code className="font-mono">tricky</code>.
          </p>
          {questionTags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {questionTags.map((t) => (
                <li
                  key={t}
                  className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {t}
                  <button
                    type="button"
                    aria-label={`Remove tag ${t}`}
                    onClick={() => removeQuestionTag(t)}
                    className="text-primary/70 hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addQuestionTag(tagInput);
                }
              }}
              placeholder="Type a tag and press Enter"
            />
            <Button type="button" variant="outline" onClick={() => addQuestionTag(tagInput)}>
              <Plus className="size-4" />
              Add
            </Button>
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

        {/* Topic tagging (existing taxonomy linker) */}
        <Card className="space-y-4 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Topic taxonomy
          </p>
          {topicTags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {topicTags.map((t) => {
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
                      onClick={() =>
                        setTopicTags((prev) => prev.filter((x) => x.topicId !== t.topicId))
                      }
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
            <Button type="button" variant="outline" disabled={!tagTopic} onClick={addTopicTag}>
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
