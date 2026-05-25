'use client';

// Admin waitlist console at /admin/waitlist.
// Hydrates from `GET /api/admin/waitlist` (filtered), supports a client-side
// CSV export of the current view, and a voucher-draw action (`POST
// /api/admin/waitlist/draw`) that picks N random non-winners from the same
// filter and stamps them with a `voucher_code`.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarDays,
  Download,
  Loader2,
  Search,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react';

import { adminHttp } from '@/lib/api/client';
import { PageHeader } from '@/components/shell/page-header';
import { Pager } from '@/components/shell/pager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

// ── Slugs accepted by the receiver — keep in sync with backend's COMP_SLUGS.
const COMP_SLUGS = [
  'emc',
  'ispo',
  'osebi',
  'komodo',
  'genius',
  'owlypia',
  'mathchallenge',
  'stemolympiad',
  'nextgen',
  'youngmaster',
  'angkor',
  'igo',
] as const;

const DATE_RANGES = [
  { key: 'all', label: 'All time', hours: null },
  { key: '24h', label: 'Last 24h', hours: 24 },
  { key: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { key: '30d', label: 'Last 30 days', hours: 24 * 30 },
] as const;

const LIMIT = 50;

interface WaitlistEntry {
  id: number;
  comp: string;
  lang: string | null;
  nama: string;
  kelas: string;
  kota: string;
  email: string;
  whatsapp: string;
  submitted_at: string;
  source: string;
  user_agent: string | null;
  ip_hint: string | null;
  is_voucher_winner: boolean;
  voucher_code: string | null;
  voucher_drawn_at: string | null;
  created_at: string;
}

interface ListResponse {
  entries: WaitlistEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCSV(rows: WaitlistEntry[]): void {
  const header = [
    'id', 'comp', 'lang', 'nama', 'kelas', 'kota', 'email', 'whatsapp',
    'submitted_at', 'source', 'is_voucher_winner', 'voucher_code',
    'voucher_drawn_at', 'created_at',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      String(r.id),
      r.comp,
      r.lang ?? '',
      csvEscape(r.nama),
      r.kelas,
      csvEscape(r.kota),
      r.email,
      r.whatsapp,
      r.submitted_at,
      csvEscape(r.source),
      r.is_voucher_winner ? 'true' : 'false',
      r.voucher_code ?? '',
      r.voucher_drawn_at ?? '',
      r.created_at,
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function WaitlistAdminPage() {
  // Filters
  const [comp, setComp] = useState<string>('all');
  const [voucher, setVoucher] = useState<'all' | 'won' | 'open'>('all');
  const [range, setRange] = useState<string>('all');
  const [searchVal, setSearchVal] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Data
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Voucher-draw dialog
  const [drawOpen, setDrawOpen] = useState(false);
  const [drawCount, setDrawCount] = useState(10);
  const [drawing, setDrawing] = useState(false);
  const [drawResult, setDrawResult] = useState<
    | { drawn: number; entries: Array<{ id: number; comp: string; email: string; voucher_code: string }> }
    | null
  >(null);

  const sinceISO = useMemo(() => {
    const r = DATE_RANGES.find((x) => x.key === range);
    if (!r?.hours) return undefined;
    return new Date(Date.now() - r.hours * 3600_000).toISOString();
  }, [range]);

  const buildQuery = useCallback(
    (override?: Partial<{ page: number; limit: number }>) => {
      const q = new URLSearchParams();
      q.set('page', String(override?.page ?? page));
      q.set('limit', String(override?.limit ?? LIMIT));
      if (comp !== 'all') q.set('comp', comp);
      if (voucher !== 'all') q.set('voucher', voucher);
      if (sinceISO) q.set('since', sinceISO);
      if (search) q.set('search', search);
      return q.toString();
    },
    [page, comp, voucher, sinceISO, search],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminHttp.get<ListResponse>(`/admin/waitlist?${buildQuery()}`);
      setEntries(r.entries);
      setTotal(r.pagination.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load waitlist');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  // CSV: export the FILTERED view (not just current page) — re-fetches up
  // to 5000 rows so admins get the whole audience for a draw or email.
  async function handleExport() {
    try {
      const r = await adminHttp.get<ListResponse>(
        `/admin/waitlist?${buildQuery({ page: 1, limit: 5000 })}`,
      );
      if (r.entries.length === 0) {
        toast.error('No entries match the current filter');
        return;
      }
      downloadCSV(r.entries);
      toast.success(`Exported ${r.entries.length} entries`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to export CSV');
    }
  }

  async function handleDraw() {
    setDrawing(true);
    setDrawResult(null);
    try {
      const r = await adminHttp.post<{
        drawn: number;
        entries: Array<{ id: number; comp: string; email: string; voucher_code: string }>;
      }>('/admin/waitlist/draw', {
        count: Math.max(1, Math.min(500, drawCount)),
        ...(comp !== 'all' ? { comp } : {}),
        ...(sinceISO ? { since: sinceISO } : {}),
        ...(search ? { search } : {}),
      });
      setDrawResult(r);
      if (r.drawn === 0) {
        toast.error('No eligible entries — everyone in this filter already won.');
      } else {
        toast.success(`Drew ${r.drawn} voucher winner${r.drawn === 1 ? '' : 's'}`);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Voucher draw failed');
    } finally {
      setDrawing(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Marketing"
        title="Waitlist"
        subtitle="Pre-registration signups forwarded from the competzy-web subdomains. Run voucher draws or export the audience for outreach."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="size-4" />
              Export CSV
            </Button>
            <Button onClick={() => { setDrawResult(null); setDrawOpen(true); }}>
              <Sparkles className="size-4" />
              Run voucher draw
            </Button>
          </div>
        }
      />

      {/* Filters row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Competition</Label>
          <Select value={comp} onValueChange={(v) => { setComp(v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All competitions</SelectItem>
              {COMP_SLUGS.map((s) => (
                <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date range</Label>
          <Select value={range} onValueChange={(v) => { setRange(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <form
          className="space-y-1.5"
          onSubmit={(e) => { e.preventDefault(); setSearch(searchVal.trim()); setPage(1); }}
        >
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-64 pl-9"
                placeholder="Name, email, or city…"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline">Search</Button>
            {search && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setSearch(''); setSearchVal(''); setPage(1); }}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        </form>

        <Tabs
          value={voucher}
          onValueChange={(v) => { setVoucher(v as 'all' | 'won' | 'open'); setPage(1); }}
          className="ml-auto"
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="won">Voucher Winners</TabsTrigger>
            <TabsTrigger value="open">Not Yet Drawn</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-28">Time</TableHead>
                <TableHead className="w-24">Comp</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-16">Grade</TableHead>
                <TableHead className="w-32">City</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-32">WhatsApp</TableHead>
                <TableHead className="w-44">Voucher</TableHead>
                <TableHead className="w-32">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={10}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-sm text-muted-foreground">
                    No waitlist entries match the current filter.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((e, idx) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {(page - 1) * LIMIT + idx + 1}
                    </TableCell>
                    <TableCell
                      className="font-mono text-[11px] text-muted-foreground"
                      title={new Date(e.submitted_at).toLocaleString()}
                    >
                      {relativeTime(e.submitted_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {e.comp}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{e.nama}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{e.kelas}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.kota}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(e.email); toast.success('Email copied'); }}
                        className="hover:text-foreground hover:underline"
                        title="Click to copy"
                      >
                        {e.email}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      <a
                        href={`https://wa.me/${e.whatsapp.replace(/[^\d]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-foreground hover:underline"
                      >
                        {e.whatsapp}
                      </a>
                    </TableCell>
                    <TableCell>
                      {e.is_voucher_winner ? (
                        <div className="flex items-center gap-1.5">
                          <Ticket className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                            {e.voucher_code}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] italic text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell className="truncate font-mono text-[10px] text-muted-foreground" title={e.source}>
                      {e.source}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
      </Card>

      {/* Voucher-draw dialog */}
      <Dialog open={drawOpen} onOpenChange={(o) => { setDrawOpen(o); if (!o) setDrawResult(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Run voucher draw</DialogTitle>
            <DialogDescription>
              Randomly picks entries from the <strong>current filter</strong> that haven&apos;t won
              yet, marks them as winners, and generates a unique voucher code per row.
            </DialogDescription>
          </DialogHeader>

          {!drawResult ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="draw-count">How many winners?</Label>
                <Input
                  id="draw-count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={500}
                  value={drawCount}
                  onChange={(e) => setDrawCount(parseInt(e.target.value, 10) || 1)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Range: 1–500. Filter scope: <strong>{comp === 'all' ? 'all competitions' : comp}</strong>
                  {sinceISO && <>, since {new Date(sinceISO).toLocaleDateString()}</>}.
                </p>
              </div>
              <div className="rounded-md border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <CalendarDays className="mr-1 inline size-3.5" />
                This action is idempotent — already-drawn entries are skipped, so re-running won&apos;t double-count.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                Drew <strong>{drawResult.drawn}</strong> winner{drawResult.drawn === 1 ? '' : 's'}.
              </p>
              {drawResult.drawn > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px]">
                  {drawResult.entries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 px-1 py-0.5">
                      <span className="truncate text-muted-foreground">{e.email}</span>
                      <span className="font-semibold text-foreground">{e.voucher_code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!drawResult ? (
              <>
                <Button variant="outline" onClick={() => setDrawOpen(false)} disabled={drawing}>
                  Cancel
                </Button>
                <Button onClick={handleDraw} disabled={drawing || drawCount < 1}>
                  {drawing && <Loader2 className="size-4 animate-spin" />}
                  Draw {drawCount}
                </Button>
              </>
            ) : (
              <Button onClick={() => setDrawOpen(false)}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
