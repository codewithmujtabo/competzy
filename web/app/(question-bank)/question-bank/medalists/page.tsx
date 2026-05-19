'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Award } from 'lucide-react';
import { questionBankHttp } from '@/lib/auth/question-bank-context';
import { CompetitionPicker, useQuestionBank } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MedalRow {
  registrationId: string;
  studentName: string;
  email: string;
  status: string;
  roundId: string | null;
  roundName: string | null;
  qualifyingScore: number | null;
  score: number | null;
  isMedalist: boolean | null;
  medalistLocked: boolean;
}

export default function MedalistsPage() {
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<MedalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    questionBankHttp
      .get<MedalRow[]>(`/question-bank/medalists?compId=${encodeURIComponent(selectedId)}`)
      .then(setRows)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load medalists'))
      .finally(() => setLoading(false));
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (r: MedalRow) => {
    setBusy(r.registrationId);
    try {
      await questionBankHttp.put(`/question-bank/medalists/${r.registrationId}`, {
        isMedalist: !r.isMedalist,
      });
      toast.success(
        `${r.studentName} ${!r.isMedalist ? 'marked as a medalist' : 'removed as a medalist'}.`,
      );
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update medalist');
    } finally {
      setBusy(null);
    }
  };

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Question Bank" title="Medalists" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Medalist management is available for native competitions only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Question Bank"
        title="Medalists"
        subtitle="Scored entrants and their medal status. Medals are auto-decided from the score; override one here when needed."
      />

      <CompetitionPicker className="w-full sm:w-72" />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="w-44">Round</TableHead>
                <TableHead className="w-24">Score</TableHead>
                <TableHead className="w-32">Medal score</TableHead>
                <TableHead className="w-48 text-right">Medalist</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                    No scored entrants yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.registrationId}>
                    <TableCell>
                      <div className="truncate font-medium text-foreground">{r.studentName}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                    </TableCell>
                    <TableCell className="truncate text-sm">{r.roundName ?? '—'}</TableCell>
                    <TableCell className="font-serif text-base font-medium text-foreground tabular-nums">
                      {r.score ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {r.qualifyingScore != null ? `≥ ${r.qualifyingScore}` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.medalistLocked && (
                          <Badge
                            variant="outline"
                            className="border-transparent bg-muted font-mono text-[9px] uppercase text-muted-foreground"
                          >
                            overridden
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant={r.isMedalist ? 'default' : 'outline'}
                          disabled={busy === r.registrationId}
                          onClick={() => toggle(r)}
                        >
                          <Award className="size-3.5" />
                          {r.isMedalist ? 'Medalist' : 'Not medalled'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
