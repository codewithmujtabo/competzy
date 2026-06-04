'use client';

// Admin → Registrations. Lists every competition registration with the same
// status tabs as before, plus filters the legacy site had: per-competition,
// per-year, free-text search, and pagination instead of an endless scroll.
// Each row exposes a "View" action that opens a read-only detail dialog
// (student profile + competition + round + status).

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Eye } from 'lucide-react';
import { competitionsApi, registrationsApi } from '@/lib/api';
import type { Competition, PendingRegistration } from '@/types';
import { PageHeader } from '@/components/shell/page-header';
import { Pager } from '@/components/shell/pager';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';
import type { MessageKey } from '@/lib/i18n/messages/en';

const STATUSES: { key: string; labelKey: MessageKey }[] = [
  { key: 'all', labelKey: 'adm.reg.tabAll' },
  { key: 'pending_review', labelKey: 'adm.reg.tabPending' },
  { key: 'approved', labelKey: 'adm.reg.tabApproved' },
  { key: 'rejected', labelKey: 'adm.reg.tabRejected' },
];

const STATUS_STYLE: Record<string, string> = {
  pending_review: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  pending_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  pending_payment: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  registered: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

const LIMIT = 25;
// Year filter — current year ±2 covers every realistic registration window.
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

function formatFee(fee: number) {
  return fee === 0 ? 'Free' : `Rp ${fee.toLocaleString('id-ID')}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent font-mono text-[10px] capitalize',
        STATUS_STYLE[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

export default function RegistrationsPage() {
  const t = useT();
  const [items, setItems] = useState<PendingRegistration[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [compId, setCompId] = useState<string>('all');
  const [year, setYear] = useState<string>('all');
  // Debounced search input — committed only after the user pauses typing so
  // we don't refetch on every keystroke.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [viewing, setViewing] = useState<PendingRegistration | null>(null);

  // Competition list for the filter dropdown — loaded once on mount.
  const [comps, setComps] = useState<Competition[]>([]);
  useEffect(() => {
    competitionsApi
      .list({ page: 1, limit: 200 })
      .then((r) => setComps(Array.isArray(r?.competitions) ? r.competitions : []))
      .catch(() => { /* filter still works, just no dropdown options */ });
  }, []);

  // Commit the search input after a short idle period.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter change resets to page 1 so the user never lands on an empty
  // intermediate page.
  useEffect(() => {
    setPage(1);
  }, [tab, compId, year, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await registrationsApi.listPending({
        status: tab,
        compId: compId === 'all' ? undefined : compId,
        year: year === 'all' ? undefined : Number(year),
        search: search || undefined,
        page,
        limit: LIMIT,
      });
      setItems(r.pendingRegistrations ?? []);
      setTotal(r.pagination?.total ?? r.pendingRegistrations?.length ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load registrations');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tab, compId, year, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (id: string) => {
    setBusy(id);
    try {
      await registrationsApi.approve(id);
      toast.success('Registration approved — student notified.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setBusy(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectId || !reason.trim()) return;
    setBusy(rejectId);
    try {
      await registrationsApi.reject(rejectId, reason.trim());
      toast.success('Registration rejected — student notified.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setBusy(null);
      setRejectId(null);
      setReason('');
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={t('adm.eyebrow')}
        title={t('opnav.registrations')}
        subtitle={t('adm.reg.subtitle')}
      />

      <div className="flex flex-wrap items-end gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {STATUSES.map((s) => (
              <TabsTrigger key={s.key} value={s.key}>
                {t(s.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={compId} onValueChange={setCompId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={t('adm.reg.allCompetitions')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adm.reg.allCompetitions')}</SelectItem>
              {comps.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t('adm.reg.allYears')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adm.reg.allYears')}</SelectItem>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('adm.reg.search')}
            className="w-[240px]"
          />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed min-w-[1024px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('adm.reg.colStudent')}</TableHead>
                <TableHead>{t('adm.reg.colSchoolGrade')}</TableHead>
                <TableHead>{t('adm.reg.colCompetition')}</TableHead>
                <TableHead className="w-24">{t('adm.reg.colFee')}</TableHead>
                <TableHead className="w-32">{t('adm.reg.colStatus')}</TableHead>
                <TableHead className="w-28">{t('adm.reg.colSubmitted')}</TableHead>
                <TableHead className="w-48 text-right">{t('adm.reg.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    {t('adm.reg.noResults')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((r) => (
                  <TableRow key={r.registrationId}>
                    <TableCell>
                      <div className="truncate font-medium text-foreground">{r.student.name}</div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        {r.student.email}
                      </div>
                      {r.student.phone && (
                        <div className="truncate font-mono text-[11px] text-muted-foreground">
                          {r.student.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="truncate text-sm">{r.student.school || '—'}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        Grade {r.student.grade || '—'}
                      </div>
                      {r.student.nisn && (
                        <div className="truncate font-mono text-[10px] text-muted-foreground">
                          NISN {r.student.nisn}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      <div className="truncate">{r.competition.name}</div>
                      {r.round?.name && (
                        <div className="truncate text-xs text-muted-foreground">{r.round.name}</div>
                      )}
                      {r.registrationNumber && (
                        <div className="truncate font-mono text-[10px] text-muted-foreground">
                          {r.registrationNumber}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-transparent font-mono text-[10px]',
                          r.competition.fee === 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
                        )}
                      >
                        {formatFee(r.competition.fee)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {new Date(r.registeredAt).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewing(r)}
                          title={t('adm.reg.viewDetails')}
                        >
                          <Eye className="size-3.5" />
                          {t('adm.reg.view')}
                        </Button>
                        {r.status === 'pending_review' && (
                          <>
                            <Button
                              size="sm"
                              disabled={busy === r.registrationId}
                              onClick={() => handleApprove(r.registrationId)}
                            >
                              {busy === r.registrationId ? '…' : t('adm.reg.approve')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                              disabled={busy === r.registrationId}
                              onClick={() => {
                                setRejectId(r.registrationId);
                                setReason('');
                              }}
                            >
                              {t('adm.reg.reject')}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />

      {/* View dialog — read-only detail panel for a selected registration. */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="sm:max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.student.name}</DialogTitle>
                <DialogDescription>
                  {viewing.competition.name}
                  {viewing.round?.name ? ` — ${viewing.round.name}` : ''}
                </DialogDescription>
              </DialogHeader>

              <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
                <Cell label="Status">
                  <StatusBadge status={viewing.status} />
                </Cell>
                <Cell label="Reg. number">
                  <span className="font-mono text-xs">
                    {viewing.registrationNumber || '—'}
                  </span>
                </Cell>
                <Cell label="Submitted">
                  {new Date(viewing.registeredAt).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Cell>

                <Cell label="Email" wide>
                  <span className="font-mono text-xs">{viewing.student.email}</span>
                </Cell>
                <Cell label="Phone">
                  <span className="font-mono text-xs">{viewing.student.phone || '—'}</span>
                </Cell>

                <Cell label="School" wide>{viewing.student.school || '—'}</Cell>
                <Cell label="Grade">{viewing.student.grade || '—'}</Cell>
                <Cell label="NISN">
                  <span className="font-mono text-xs">{viewing.student.nisn || '—'}</span>
                </Cell>
                <Cell label="Country">{viewing.student.country || '—'}</Cell>

                <Cell label="City">{viewing.student.city || '—'}</Cell>
                <Cell label="Province" wide>{viewing.student.province || '—'}</Cell>

                <Cell label="Fee (local)">{formatFee(viewing.competition.fee)}</Cell>
                <Cell label="Fee (intl)" wide>
                  {viewing.competition.feeInternational != null
                    ? `$${viewing.competition.feeInternational} USD`
                    : '—'}
                </Cell>
              </dl>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog. */}
      <Dialog
        open={!!rejectId}
        onOpenChange={(open) => {
          if (!open) {
            setRejectId(null);
            setReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adm.reg.rejectTitle')}</DialogTitle>
            <DialogDescription>
              {t('adm.reg.rejectDescription')}
            </DialogDescription>
          </DialogHeader>
          <textarea
            rows={3}
            autoFocus
            placeholder={t('adm.reg.rejectReason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="flex min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectId(null);
                setReason('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || busy === rejectId}
              onClick={handleRejectSubmit}
            >
              {busy === rejectId ? t('adm.reg.rejecting') : t('adm.reg.rejectTitle')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// One label/value pair in the detail dialog. `wide` makes it span two of the
// three columns so the longer fields (email, school) breathe.
function Cell({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(wide ? 'col-span-2' : 'col-span-1', 'space-y-0.5')}>
      <dt className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}
