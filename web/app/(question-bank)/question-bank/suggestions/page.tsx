'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MessageSquare, Trash2 } from 'lucide-react';
import { marketingHttp } from '@/lib/api/client';
import { CompetitionPicker, useQuestionBank } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Suggestion {
  id: string;
  content: string;
  examName: string | null;
  userName: string;
  userEmail: string;
  createdAt: string;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SuggestionsPage() {
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const r = await marketingHttp.get<Suggestion[]>(
        `/marketing/suggestions?compId=${encodeURIComponent(selectedId)}`,
      );
      setRows(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (s: Suggestion) => {
    if (!confirm('Remove this feedback from the inbox?')) return;
    setBusy(s.id);
    try {
      await marketingHttp.delete(`/marketing/suggestions/${s.id}`);
      toast.success('Suggestion removed.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete suggestion');
    } finally {
      setBusy(null);
    }
  };

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Marketing" title="Suggestions" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Student feedback is collected per native competition.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Marketing"
        title="Suggestions"
        subtitle="Feedback students submitted from the competition portal."
      />

      <CompetitionPicker className="w-full sm:w-72" />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="items-center gap-2 p-12 text-center">
          <MessageSquare className="size-7 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No feedback yet</p>
          <p className="text-sm text-muted-foreground">
            Suggestions students send from the portal will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <Card key={s.id} className="gap-0 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{s.userName}</span>
                  <span className="text-xs text-muted-foreground">{s.userEmail}</span>
                  {s.examName && (
                    <Badge variant="outline" className="text-[10px]">
                      {s.examName}
                    </Badge>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {fmtDate(s.createdAt)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    disabled={busy === s.id}
                    onClick={() => remove(s)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                {s.content}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
