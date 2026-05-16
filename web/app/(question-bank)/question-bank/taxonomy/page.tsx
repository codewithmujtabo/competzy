'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { CompetitionPicker, useQuestionBank } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TaxItem {
  id: string;
  name: string;
}

interface ColumnProps {
  title: string;
  emptyHint: string;
  disabledHint: string;
  addPlaceholder: string;
  items: TaxItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  /** When false, rows are not selectable (no chevron) — the last column. */
  selectable?: boolean;
}

function TaxonomyColumn({
  title,
  emptyHint,
  disabledHint,
  addPlaceholder,
  items,
  selectedId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  disabled,
  loading,
  selectable = true,
}: ColumnProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const submitAdd = async () => {
    const name = draft.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await onAdd(name);
      setDraft('');
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async (id: string) => {
    const name = editValue.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await onRename(id, name);
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex min-h-[22rem] flex-col gap-0 p-0">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {!disabled && (
          <span className="font-mono text-[11px] text-muted-foreground">{items.length}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {disabled ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">{disabledHint}</p>
        ) : loading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">{emptyHint}</p>
        ) : (
          <ul className="space-y-0.5">
            {items.map((it) => {
              const active = selectable && it.id === selectedId;
              if (editingId === it.id) {
                return (
                  <li key={it.id} className="flex items-center gap-1 px-1">
                    <Input
                      value={editValue}
                      autoFocus
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitEdit(it.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="h-8"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0"
                      disabled={busy || !editValue.trim()}
                      onClick={() => submitEdit(it.id)}
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                );
              }
              return (
                <li key={it.id} className="group">
                  <div
                    className={cn(
                      'flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectable && onSelect(it.id)}
                      className={cn(
                        'flex flex-1 items-center gap-1.5 truncate text-left',
                        !selectable && 'cursor-default',
                      )}
                    >
                      {selectable && (
                        <ChevronRight
                          className={cn(
                            'size-3.5 shrink-0 transition-transform',
                            active ? 'text-primary' : 'text-muted-foreground',
                          )}
                        />
                      )}
                      <span className="truncate">{it.name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Rename"
                      onClick={() => {
                        setEditingId(it.id);
                        setEditValue(it.name);
                      }}
                      className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete"
                      onClick={() => {
                        if (confirm(`Delete “${it.name}”? This also removes anything nested under it.`)) {
                          onDelete(it.id);
                        }
                      }}
                      className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!disabled && (
        <div className="flex gap-1.5 border-t p-2">
          <Input
            value={draft}
            placeholder={addPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitAdd();
            }}
            className="h-9"
          />
          <Button
            size="icon"
            className="size-9 shrink-0"
            disabled={busy || !draft.trim()}
            onClick={submitAdd}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function TaxonomyPage() {
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();

  const [subjects, setSubjects] = useState<TaxItem[]>([]);
  const [topics, setTopics] = useState<TaxItem[]>([]);
  const [subtopics, setSubtopics] = useState<TaxItem[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingSubtopics, setLoadingSubtopics] = useState(false);

  const err = (e: unknown, fallback: string) =>
    toast.error(e instanceof Error ? e.message : fallback);

  const loadSubjects = useCallback(async (compId: string) => {
    setLoadingSubjects(true);
    try {
      setSubjects(
        await questionBankHttp.get<TaxItem[]>(
          `/question-bank/subjects?compId=${encodeURIComponent(compId)}`,
        ),
      );
    } catch (e) {
      err(e, 'Failed to load subjects');
    } finally {
      setLoadingSubjects(false);
    }
  }, []);

  const loadTopics = useCallback(async (compId: string, subId: string) => {
    setLoadingTopics(true);
    try {
      setTopics(
        await questionBankHttp.get<TaxItem[]>(
          `/question-bank/topics?compId=${encodeURIComponent(compId)}&subjectId=${encodeURIComponent(subId)}`,
        ),
      );
    } catch (e) {
      err(e, 'Failed to load topics');
    } finally {
      setLoadingTopics(false);
    }
  }, []);

  const loadSubtopics = useCallback(async (compId: string, topId: string) => {
    setLoadingSubtopics(true);
    try {
      setSubtopics(
        await questionBankHttp.get<TaxItem[]>(
          `/question-bank/subtopics?compId=${encodeURIComponent(compId)}&topicId=${encodeURIComponent(topId)}`,
        ),
      );
    } catch (e) {
      err(e, 'Failed to load subtopics');
    } finally {
      setLoadingSubtopics(false);
    }
  }, []);

  // Competition changed → reload subjects, clear the deeper levels.
  useEffect(() => {
    setSubjectId(null);
    setTopicId(null);
    setTopics([]);
    setSubtopics([]);
    if (selectedId) loadSubjects(selectedId);
    else setSubjects([]);
  }, [selectedId, loadSubjects]);

  // Subject changed → reload topics, clear subtopics.
  useEffect(() => {
    setTopicId(null);
    setSubtopics([]);
    if (selectedId && subjectId) loadTopics(selectedId, subjectId);
    else setTopics([]);
  }, [selectedId, subjectId, loadTopics]);

  // Topic changed → reload subtopics.
  useEffect(() => {
    if (selectedId && topicId) loadSubtopics(selectedId, topicId);
    else setSubtopics([]);
  }, [selectedId, topicId, loadSubtopics]);

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Question Bank" title="Taxonomy" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The question bank is available for native competitions only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Question Bank"
        title="Taxonomy"
        subtitle="Organise the bank into subjects, topics and subtopics. Questions are tagged against them."
      />

      <CompetitionPicker />

      <div className="grid gap-4 lg:grid-cols-3">
        <TaxonomyColumn
          title="Subjects"
          emptyHint="No subjects yet. Add the first one below."
          disabledHint="Select a competition first."
          addPlaceholder="New subject…"
          items={subjects}
          selectedId={subjectId}
          onSelect={setSubjectId}
          disabled={!selectedId}
          loading={loadingSubjects}
          onAdd={async (name) => {
            try {
              await questionBankHttp.post('/question-bank/subjects', {
                compId: selectedId,
                name,
              });
              toast.success('Subject added.');
              await loadSubjects(selectedId);
            } catch (e) {
              err(e, 'Failed to add subject');
            }
          }}
          onRename={async (id, name) => {
            try {
              await questionBankHttp.put(`/question-bank/subjects/${id}`, { name });
              await loadSubjects(selectedId);
            } catch (e) {
              err(e, 'Failed to rename subject');
            }
          }}
          onDelete={async (id) => {
            try {
              await questionBankHttp.delete(`/question-bank/subjects/${id}`);
              if (subjectId === id) setSubjectId(null);
              toast.success('Subject removed.');
              await loadSubjects(selectedId);
            } catch (e) {
              err(e, 'Failed to delete subject');
            }
          }}
        />

        <TaxonomyColumn
          title="Topics"
          emptyHint="No topics for this subject yet."
          disabledHint="Select a subject to manage its topics."
          addPlaceholder="New topic…"
          items={topics}
          selectedId={topicId}
          onSelect={setTopicId}
          disabled={!subjectId}
          loading={loadingTopics}
          onAdd={async (name) => {
            try {
              await questionBankHttp.post('/question-bank/topics', {
                compId: selectedId,
                parentId: subjectId,
                name,
              });
              toast.success('Topic added.');
              await loadTopics(selectedId, subjectId!);
            } catch (e) {
              err(e, 'Failed to add topic');
            }
          }}
          onRename={async (id, name) => {
            try {
              await questionBankHttp.put(`/question-bank/topics/${id}`, { name });
              await loadTopics(selectedId, subjectId!);
            } catch (e) {
              err(e, 'Failed to rename topic');
            }
          }}
          onDelete={async (id) => {
            try {
              await questionBankHttp.delete(`/question-bank/topics/${id}`);
              if (topicId === id) setTopicId(null);
              toast.success('Topic removed.');
              await loadTopics(selectedId, subjectId!);
            } catch (e) {
              err(e, 'Failed to delete topic');
            }
          }}
        />

        <TaxonomyColumn
          title="Subtopics"
          emptyHint="No subtopics for this topic yet."
          disabledHint="Select a topic to manage its subtopics."
          addPlaceholder="New subtopic…"
          items={subtopics}
          selectedId={null}
          selectable={false}
          onSelect={() => {}}
          disabled={!topicId}
          loading={loadingSubtopics}
          onAdd={async (name) => {
            try {
              await questionBankHttp.post('/question-bank/subtopics', {
                compId: selectedId,
                parentId: topicId,
                name,
              });
              toast.success('Subtopic added.');
              await loadSubtopics(selectedId, topicId!);
            } catch (e) {
              err(e, 'Failed to add subtopic');
            }
          }}
          onRename={async (id, name) => {
            try {
              await questionBankHttp.put(`/question-bank/subtopics/${id}`, { name });
              await loadSubtopics(selectedId, topicId!);
            } catch (e) {
              err(e, 'Failed to rename subtopic');
            }
          }}
          onDelete={async (id) => {
            try {
              await questionBankHttp.delete(`/question-bank/subtopics/${id}`);
              toast.success('Subtopic removed.');
              await loadSubtopics(selectedId, topicId!);
            } catch (e) {
              err(e, 'Failed to delete subtopic');
            }
          }}
        />
      </div>
    </div>
  );
}
