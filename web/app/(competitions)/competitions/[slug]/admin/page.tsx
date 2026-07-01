'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import type { MessageKey } from '@/lib/i18n/messages/en';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PendingRow {
  registrationId: string;
  status: string;
  registeredAt: string;
  student: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    school: string | null;
    grade: string | null;
    nisn: string | null;
  };
  competition: { id: string; name: string; fee: number };
}

type StatusFilter = 'pending_review' | 'pending_payment' | 'paid' | 'rejected' | 'all';
const FILTERS: StatusFilter[] = ['pending_review', 'pending_payment', 'paid', 'rejected', 'all'];
const STATUS_KEY: Record<string, MessageKey> = {
  pending_review: 'cap.statusPendingReview',
  pending_payment: 'cap.statusPendingPayment',
  paid: 'cap.statusPaid',
  rejected: 'cap.statusRejected',
  all: 'cap.statusAll',
};

export default function CompetitionAdminPage() {
  const t = useT();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);

  const router = useRouter();
  const { logout } = useCompetitionAuth();
  const { comp } = usePortalComp(slug);

  const [rows, setRows] = useState<PendingRow[] | null>(null);
  const [status, setStatus] = useState<StatusFilter>('pending_review');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  const refresh = async () => {
    if (!comp?.id) return;
    setRows(null);
    setErr(null);
    try {
      const qp = new URLSearchParams({ compId: comp.id, status });
      const data = await emcHttp.get<{ pendingRegistrations: PendingRow[] }>(
        `/admin/registrations/pending?${qp.toString()}`,
      );
      setRows(data.pendingRegistrations);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cap.failLoad'));
    }
  };

  const statusLabel = (s: string) => (STATUS_KEY[s] ? t(STATUS_KEY[s]) : s.replace(/_/g, ' '));

  useEffect(() => {
    void refresh();
  }, [comp?.id, status]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id);
    setErr(null);
    try {
      const body = action === 'reject' ? { reason: 'Reviewed in competition admin' } : {};
      await emcHttp.post(`/admin/registrations/${id}/${action}`, body);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('cap.failLoad'));
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    await logout();
    router.replace(paths.login);
  };

  if (!config) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-5xl space-y-5 p-6 lg:p-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
              {config.shortName} 2026 · {t('cap.admin')}
            </p>
            <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">{t('cap.registrations')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
              ← {t('cap.fullAdmin')}
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              {t('shell.signOut')}
            </Button>
          </div>
        </header>

        <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <TabsList>
            {FILTERS.map((s) => (
              <TabsTrigger key={s} value={s}>
                {statusLabel(s)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {err && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {err}
          </div>
        )}

        {!comp?.id ? (
          <Card className="p-8 text-center text-sm text-amber-600 dark:text-amber-400">
            {t('cap.notConfigured', { name: config.shortName })}
          </Card>
        ) : rows === null ? (
          <Card className="items-center gap-3 p-10 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('cap.loading')}</p>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1024px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('cap.colStudent')}</TableHead>
                    <TableHead>{t('cap.colSchool')}</TableHead>
                    <TableHead>{t('cap.colGrade')}</TableHead>
                    <TableHead>{t('adm.colStatus')}</TableHead>
                    <TableHead className="text-right">{t('acp.colActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-28 text-center text-sm text-muted-foreground">
                        {t('cap.empty', { status: statusLabel(status), name: config.shortName })}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.registrationId}>
                        <TableCell>
                          <div className="font-medium text-foreground">{r.student.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {r.student.email}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{r.student.school || '-'}</TableCell>
                        <TableCell className="text-sm">{r.student.grade || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {statusLabel(r.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === 'pending_review' && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                disabled={busy === r.registrationId}
                                onClick={() => act(r.registrationId, 'approve')}
                              >
                                {busy === r.registrationId ? '…' : t('cap.approve')}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                disabled={busy === r.registrationId}
                                onClick={() => act(r.registrationId, 'reject')}
                              >
                                {t('cap.reject')}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
