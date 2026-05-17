'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardCheck, FileText, FolderTree, Layers, PencilLine } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { CompetitionPicker, useQuestionBank } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { StatCard } from '@/components/shell/stat-card';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface QuestionRow {
  id: string;
  status: string;
}

export default function QuestionBankDashboard() {
  const { selectedId, selected, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    questionBankHttp
      .get<QuestionRow[]>(`/question-bank/questions?compId=${encodeURIComponent(selectedId)}`)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const draft = rows.filter((q) => q.status === 'draft').length;
  const submitted = rows.filter((q) => q.status === 'submitted').length;
  const approved = rows.filter((q) => q.status === 'approved').length;

  const busy = loading || compsLoading;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Question Bank"
        title="Dashboard"
        subtitle="Author and review the question bank for your native competitions."
      />

      {!compsLoading && competitions.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The question bank is available for native competitions. Create one — affiliated
            competitions are run on an external platform and have no bank here.
          </p>
        </Card>
      ) : (
        <>
          <CompetitionPicker />

          {selected && (
            <p className="text-sm text-muted-foreground">
              Showing the bank for{' '}
              <span className="font-medium text-foreground">{selected.name}</span>.
            </p>
          )}

          {busy ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Questions" value={rows.length} icon={Layers} accent="teal" />
              <StatCard label="Drafts" value={draft} icon={PencilLine} accent="amber" />
              <StatCard
                label="Awaiting Review"
                value={submitted}
                icon={ClipboardCheck}
                accent="indigo"
              />
              <StatCard label="Approved" value={approved} icon={CheckCircle2} accent="green" />
            </div>
          )}

          <Card className="p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Get started
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Link
                href="/question-bank/taxonomy"
                className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-1/10 text-chart-1">
                  <FolderTree className="size-[1.1rem]" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">Manage taxonomy</p>
                  <p className="text-xs text-muted-foreground">
                    Subjects, topics and subtopics for this competition.
                  </p>
                </div>
              </Link>
              <Link
                href="/question-bank/questions"
                className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-2/10 text-chart-2">
                  <FileText className="size-[1.1rem]" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">Author questions</p>
                  <p className="text-xs text-muted-foreground">
                    Write, review and approve multiple-choice and short-answer questions.
                  </p>
                </div>
              </Link>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
