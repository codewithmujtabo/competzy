'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { useT } from '@/lib/i18n/context';
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

const BLANK = '__blank__';

interface PaperAnswer {
  id: string;
  number: number;
  type: string;
  questionContent: string;
  explanation: string | null;
  isCorrect: boolean | null;
  point: number | null;
  options: { id: string; content: string; isCorrect: boolean }[];
  selectedOptionId: string | null;
  answerText: string | null;
  answerKey: string | null;
}
interface PaperExam {
  id: string;
  examName: string;
  examCode: string;
  studentName: string;
  grade: string | null;
  testCenterName: string | null;
  totalPoint: number | null;
  corrects: { choice?: number; short?: number };
  wrongs: { choice?: number; short?: number };
  blanks: { choice?: number; short?: number };
  suggestedCorrectPoint: number;
  suggestedWrongPoint: number;
  answers: PaperAnswer[];
}

type Mark = 'correct' | 'wrong' | 'none';
interface Entry {
  value: string;
  mark: Mark;
  point: string;
}

const sum = (o: { choice?: number; short?: number }) => (o.choice ?? 0) + (o.short ?? 0);

export default function PaperExamSheetPage() {
  const t = useT();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [paper, setPaper] = useState<PaperExam | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await questionBankHttp.get<PaperExam>(`/question-bank/paper-exams/${id}`);
      setPaper(p);
      const next: Record<string, Entry> = {};
      for (const a of p.answers) {
        next[a.id] = {
          value: a.type === 'short_answer' ? a.answerText ?? '' : a.selectedOptionId ?? '',
          mark: a.isCorrect === true ? 'correct' : a.isCorrect === false ? 'wrong' : 'none',
          point:
            a.point != null ? String(a.point) : String(p.suggestedCorrectPoint),
        };
      }
      setEntries(next);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const setEntry = (aid: string, patch: Partial<Entry>) =>
    setEntries((prev) => ({ ...prev, [aid]: { ...prev[aid], ...patch } }));

  const save = async () => {
    if (!paper) return;
    setSaving(true);
    try {
      const answers = paper.answers.map((a) => {
        const e = entries[a.id];
        if (a.type === 'short_answer') {
          return {
            number: a.number,
            value: e.value,
            isCorrect: e.mark === 'correct' ? true : e.mark === 'wrong' ? false : null,
            point: e.mark === 'none' ? 0 : Number(e.point) || 0,
          };
        }
        return { number: a.number, value: e.value };
      });
      const updated = await questionBankHttp.put<PaperExam>(
        `/question-bank/paper-exams/${id}/answers`,
        { answers },
      );
      toast.success(t('pp.sheetSaved'));
      setPaper(updated);
      const next: Record<string, Entry> = {};
      for (const a of updated.answers) {
        next[a.id] = {
          value: a.type === 'short_answer' ? a.answerText ?? '' : a.selectedOptionId ?? '',
          mark: a.isCorrect === true ? 'correct' : a.isCorrect === false ? 'wrong' : 'none',
          point: a.point != null ? String(a.point) : String(updated.suggestedCorrectPoint),
        };
      }
      setEntries(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('pp.failSave'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !paper) {
    return (
      <div className="mx-auto max-w-[900px] space-y-6 p-6 lg:p-8">
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">{t('pp.notFound')}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/question-bank/paper')}>
            <ArrowLeft className="size-4" />
            {t('pp.backToPaper')}
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
          onClick={() => router.push('/question-bank/paper')}
        >
          <ArrowLeft className="size-4" />
          {t('pp.paperExams')}
        </Button>
        <PageHeader
          eyebrow={`${t('opnav.questionBank')} · ${paper.examCode}`}
          title={paper.studentName}
          subtitle={[
            paper.grade ? t('pp.grade', { g: paper.grade }) : null,
            paper.examName,
            paper.testCenterName,
          ]
            .filter(Boolean)
            .join(' · ')}
          actions={
            <Button onClick={save} disabled={saving}>
              <Save className="size-4" />
              {saving ? t('cf.saving') : t('pp.saveSheet')}
            </Button>
          }
        />
      </div>

      <Card className="flex flex-wrap items-center gap-6 p-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {t('pp.totalScore')}
          </p>
          <p className="font-serif text-2xl font-medium text-foreground">{paper.totalPoint ?? 0}</p>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-emerald-600 dark:text-emerald-400">{t('pp.correctCount', { n: sum(paper.corrects) })}</span>
          <span className="text-red-600 dark:text-red-400">{t('pp.wrongCount', { n: sum(paper.wrongs) })}</span>
          <span className="text-muted-foreground">{t('pp.blankCount', { n: sum(paper.blanks) })}</span>
        </div>
      </Card>

      <div className="space-y-4">
        {paper.answers.map((a) => {
          const e = entries[a.id];
          return (
            <Card key={a.id} className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  Q{a.number}
                </Badge>
                <Badge variant="outline" className="font-mono text-[9px]">
                  {a.type === 'short_answer' ? t('qe.sa') : t('qe.mc')}
                </Badge>
                {a.isCorrect === true && (
                  <Badge className="bg-emerald-600 font-mono text-[9px] text-white">
                    {t('pp.correctPoint', { pt: a.point ?? 0 })}
                  </Badge>
                )}
                {a.isCorrect === false && (
                  <Badge variant="destructive" className="font-mono text-[9px]">
                    {t('pp.wrongPoint', { pt: a.point ?? 0 })}
                  </Badge>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{a.questionContent}</p>

              {a.type === 'short_answer' ? (
                <div className="space-y-3">
                  <div>
                    <Label className="mb-1.5 text-xs text-muted-foreground">
                      {t('pp.writtenAnswer')}
                    </Label>
                    <Input
                      value={e.value}
                      onChange={(ev) => setEntry(a.id, { value: ev.target.value })}
                      placeholder={t('pp.writtenPlaceholder')}
                    />
                  </div>
                  {a.answerKey && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">{t('pp.answerKey')}</span> {a.answerKey}
                    </p>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <Label className="mb-1 text-xs text-muted-foreground">{t('pp.mark')}</Label>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={e.mark === 'correct' ? 'default' : 'outline'}
                          onClick={() => setEntry(a.id, { mark: 'correct' })}
                        >
                          {t('pp.correct')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={e.mark === 'wrong' ? 'default' : 'outline'}
                          onClick={() => setEntry(a.id, { mark: 'wrong' })}
                        >
                          {t('pp.wrong')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={e.mark === 'none' ? 'default' : 'outline'}
                          onClick={() => setEntry(a.id, { mark: 'none' })}
                        >
                          {t('pp.ungraded')}
                        </Button>
                      </div>
                    </div>
                    {e.mark !== 'none' && (
                      <div>
                        <Label className="mb-1 text-xs text-muted-foreground">{t('pp.points')}</Label>
                        <Input
                          type="number"
                          className="h-9 w-24"
                          value={e.point}
                          onChange={(ev) => setEntry(a.id, { point: ev.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="mb-1.5 text-xs text-muted-foreground">
                    {t('pp.optionMarked')}
                  </Label>
                  <Select
                    value={e.value || BLANK}
                    onValueChange={(v) => setEntry(a.id, { value: v === BLANK ? '' : v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={BLANK}>{t('pp.blankOption')}</SelectItem>
                      {a.options.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.content}
                          {o.isCorrect ? '  ✓' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-xs text-muted-foreground">{t('pp.mcAutoGrade')}</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="size-4" />
          {saving ? t('cf.saving') : t('pp.saveSheet')}
        </Button>
      </div>
    </div>
  );
}
