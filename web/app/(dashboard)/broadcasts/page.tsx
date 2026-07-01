'use client';

// Email Broadcast — kirim.email-style campaigns on Resend. Compose a branded
// email, pick a LIVE audience segment (counts straight from the DB), test it
// on your own inbox, then send. History below tracks per-campaign progress
// (the background processor drains recipients in batches).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Mail, Send, Users, XCircle } from 'lucide-react';
import { adminHttp } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/context';
import { useT } from '@/lib/i18n/context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const RichTextEditor = dynamic(
  () => import('@/components/editor/rich-text-editor').then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> },
);

type AudienceKind =
  | 'all_students'
  | 'all_parents'
  | 'all_teachers'
  | 'all_users'
  | 'competition'
  | 'lapsed';

interface Broadcast {
  id: string;
  subject: string;
  audience: { kind: AudienceKind; compId?: string; paidOnly?: boolean };
  status: 'draft' | 'sending' | 'sent' | 'failed' | 'cancelled';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  created_by_name: string | null;
}

interface AudienceMeta {
  counts: Record<Exclude<AudienceKind, 'competition'>, number>;
  competitions: Array<{ id: string; name: string }>;
}

const STATUS_TONE: Record<Broadcast['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  sending: 'bg-[#0066ff]/10 text-[#0066ff]',
  sent: 'bg-[#31ab00]/10 text-[#237a02]',
  failed: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function BroadcastsPage() {
  const t = useT();
  const { user } = useAuth();
  const [meta, setMeta] = useState<AudienceMeta | null>(null);
  const [list, setList] = useState<Broadcast[] | null>(null);

  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [kind, setKind] = useState<AudienceKind>('all_students');
  const [compId, setCompId] = useState('');
  const [paidOnly, setPaidOnly] = useState(false);
  const [preview, setPreview] = useState<{ count: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const audience = useMemo(
    () => (kind === 'competition' ? { kind, compId, paidOnly } : { kind }),
    [kind, compId, paidOnly],
  );

  const loadList = useCallback(() => {
    adminHttp
      .get<{ broadcasts: Broadcast[] }>('/admin/broadcasts')
      .then((r) => setList(r.broadcasts))
      .catch(() => setList([]));
  }, []);

  useEffect(() => {
    adminHttp
      .get<AudienceMeta>('/admin/broadcasts/audiences')
      .then(setMeta)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load audiences'));
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (user?.email && !testEmail) setTestEmail(user.email);
  }, [user?.email, testEmail]);

  // Live-poll history while any campaign is mid-send.
  const anySending = list?.some((b) => b.status === 'sending') ?? false;
  useEffect(() => {
    if (!anySending) return;
    const id = setInterval(loadList, 5000);
    return () => clearInterval(id);
  }, [anySending, loadList]);

  // Refresh the exact recipient count when the audience changes.
  useEffect(() => {
    if (kind === 'competition' && !compId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    const id = setTimeout(async () => {
      try {
        const r = await adminHttp.post<{ count: number }>('/admin/broadcasts/preview', { audience });
        if (!cancelled) setPreview({ count: r.count });
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [audience, kind, compId]);

  const bodyFilled = html.replace(/<[^>]*>/g, '').trim().length > 0;
  const canCompose = !!subject.trim() && bodyFilled && (kind !== 'competition' || !!compId);

  // Creates the draft on the server; used by both test-send and real send.
  const draftIdRef = useRef<string | null>(null);
  const createDraft = async (): Promise<string> => {
    const r = await adminHttp.post<{ broadcast: { id: string } }>('/admin/broadcasts', {
      subject: subject.trim(),
      html,
      audience,
    });
    draftIdRef.current = r.broadcast.id;
    return r.broadcast.id;
  };

  const sendTest = async () => {
    if (!canCompose || testing) return;
    setTesting(true);
    try {
      const id = await createDraft();
      await adminHttp.post(`/admin/broadcasts/${id}/test`, { email: testEmail.trim() });
      toast.success(t('bcast.testSent'));
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('bcast.testFail'));
    } finally {
      setTesting(false);
    }
  };

  const sendBroadcast = async () => {
    if (!canCompose || sending) return;
    setSending(true);
    try {
      // Reuse the draft made by a test-send when the content hasn't changed;
      // otherwise create a fresh one so what's sent is exactly what's on screen.
      const id = await createDraft();
      const r = await adminHttp.post<{ totalRecipients: number }>(`/admin/broadcasts/${id}/send`, {});
      toast.success(t('bcast.started', { n: r.totalRecipients }));
      setConfirmOpen(false);
      setSubject('');
      setHtml('');
      setPreview(null);
      loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('bcast.startFail'));
    } finally {
      setSending(false);
    }
  };

  const kindLabel = (k: AudienceKind) => t(`bcast.aud.${k}` as Parameters<typeof t>[0]);
  const compName = (id?: string) => meta?.competitions.find((c) => c.id === id)?.name ?? id ?? '';

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={t('opnav.marketing')}
        title={t('bcast.title')}
        subtitle={t('bcast.subtitle')}
      />

      {/* Composer */}
      <Card className="stagger-children gap-5 p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Label htmlFor="bc-subject" className="mb-1.5 text-xs text-muted-foreground">
              {t('bcast.subject')}
            </Label>
            <Input
              id="bc-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('bcast.subjectPh')}
              maxLength={200}
            />
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">{t('bcast.audience')}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as AudienceKind)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  ['all_students', 'all_parents', 'all_teachers', 'all_users', 'competition', 'lapsed'] as AudienceKind[]
                ).map((k) => (
                  <SelectItem key={k} value={k}>
                    {kindLabel(k)}
                    {meta && k !== 'competition' ? ` (${meta.counts[k].toLocaleString()})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {kind === 'competition' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Label className="mb-1.5 text-xs text-muted-foreground">{t('bcast.competition')}</Label>
              <Select value={compId || undefined} onValueChange={setCompId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('bcast.pickCompetition')} />
                </SelectTrigger>
                <SelectContent>
                  {(meta?.competitions ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={paidOnly}
                onChange={(e) => setPaidOnly(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              {t('bcast.paidOnly')}
            </label>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{t('bcast.body')}</Label>
            <span className="font-mono text-[11px] text-muted-foreground">{t('bcast.nameToken')}</span>
          </div>
          <RichTextEditor value={html} onChange={setHtml} placeholder={t('bcast.bodyPh')} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            {kind === 'competition' && !compId ? (
              t('bcast.pickCompetition')
            ) : previewing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : preview ? (
              <span>
                <span className="font-semibold tabular-nums text-foreground">
                  {preview.count.toLocaleString()}
                </span>{' '}
                {t('bcast.recipients')}
              </span>
            ) : (
              '—'
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@email.com"
              className="h-9 w-52"
              type="email"
            />
            <Button variant="outline" size="sm" onClick={sendTest} disabled={!canCompose || testing}>
              {testing ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              {t('bcast.sendTest')}
            </Button>
            <Button
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={!canCompose || !preview || preview.count === 0}
              className="transition-shadow duration-base ease-smooth hover:shadow-brand"
            >
              <Send className="size-4" />
              {t('bcast.send')}
            </Button>
          </div>
        </div>
      </Card>

      {/* History */}
      <Card className="overflow-hidden p-0">
        <div className="border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">{t('bcast.history')}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('bcast.historyDesc')}</p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('bcast.subject')}</TableHead>
                <TableHead className="w-48">{t('bcast.audience')}</TableHead>
                <TableHead className="w-28">{t('bcast.status')}</TableHead>
                <TableHead className="w-44">{t('bcast.progress')}</TableHead>
                <TableHead className="w-36">{t('bcast.date')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list === null ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-sm text-muted-foreground">
                    {t('bcast.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                list.map((b) => {
                  const pct =
                    b.total_recipients > 0
                      ? Math.round(((b.sent_count + b.failed_count) / b.total_recipients) * 100)
                      : 0;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="max-w-[280px] truncate font-medium text-foreground">
                        {b.subject}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {kindLabel(b.audience.kind)}
                        {b.audience.kind === 'competition' && (
                          <span className="block truncate text-xs">{compName(b.audience.compId)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`border-transparent ${STATUS_TONE[b.status]}`}>
                          {b.status === 'sending' && <Loader2 className="size-3 animate-spin" />}
                          {b.status === 'sent' && <CheckCircle2 className="size-3" />}
                          {b.status === 'failed' && <XCircle className="size-3" />}
                          {t(`bcast.st.${b.status}` as Parameters<typeof t>[0])}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {b.status === 'draft' ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-[width] duration-slow ease-out-expo"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                              {b.sent_count}/{b.total_recipients}
                              {b.failed_count > 0 && (
                                <span className="text-destructive"> ({b.failed_count}✗)</span>
                              )}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {new Date(b.created_at).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Send confirmation — mass email needs an explicit, informed yes. */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !sending && setConfirmOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('bcast.confirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('bcast.confirmDesc', {
                n: preview?.count?.toLocaleString() ?? '0',
                audience:
                  kindLabel(kind) + (kind === 'competition' ? ` · ${compName(compId)}` : ''),
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <p className="font-semibold text-foreground">{subject}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={sendBroadcast} disabled={sending}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {t('bcast.confirmSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
