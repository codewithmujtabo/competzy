'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PackageCheck, Truck, XCircle } from 'lucide-react';
import { commerceHttp } from '@/lib/api/client';
import { CompetitionPicker, useQuestionBank } from '@/lib/question-bank/context';
import { PageHeader } from '@/components/shell/page-header';
import { Pager } from '@/components/shell/pager';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const LIMIT = 20;
const TABS = ['all', 'ordered', 'paid', 'shipped', 'delivered', 'canceled'] as const;

interface OrderItem {
  id: string;
  description: string | null;
  size: string | null;
  quantity: number;
  price: number;
  subtotal: number;
}
interface Order {
  id: string;
  code: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  buyerName?: string;
  buyerEmail?: string;
  subtotal: number;
  total: number;
  trackingNumber: string | null;
  note: string | null;
  itemCount?: number;
  orderedAt: string | null;
  createdAt: string;
  items?: OrderItem[];
}

const STATUS_STYLE: Record<string, string> = {
  ordered: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  paid: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  canceled: 'bg-muted text-muted-foreground',
};

function rupiah(n: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}
function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`border-transparent font-mono text-[10px] capitalize ${STATUS_STYLE[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {status}
    </Badge>
  );
}

export default function OrdersPage() {
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const [loading, setLoading] = useState(false);

  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!selectedId) {
      setRows([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        compId: selectedId,
        page: String(page),
        limit: String(LIMIT),
      });
      if (tab !== 'all') qs.set('status', tab);
      const r = await commerceHttp.get<{ orders: Order[]; pagination: { total: number } }>(
        `/commerce/orders?${qs}`,
      );
      setRows(r.orders ?? []);
      setTotal(r.pagination?.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [selectedId, page, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (o: Order) => {
    setDetail(o);
    setTracking('');
    setDetailLoading(true);
    try {
      const full = await commerceHttp.get<Order>(`/commerce/orders/${o.id}`);
      setDetail(full);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load order');
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = async (status: string) => {
    if (!detail) return;
    if (status === 'canceled' && !confirm('Cancel this order?')) return;
    setBusy(true);
    try {
      const updated = await commerceHttp.put<Order>(`/commerce/orders/${detail.id}/status`, {
        status,
        trackingNumber: status === 'shipped' ? tracking.trim() : undefined,
      });
      setDetail(updated);
      toast.success(`Order marked ${status}.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update order');
    } finally {
      setBusy(false);
    }
  };

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Commerce" title="Orders" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Merchandise orders are available for native competitions only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Commerce"
        title="Orders"
        subtitle="Merchandise orders placed by students — review, ship and mark delivered."
      />

      <CompetitionPicker className="w-full sm:w-72" />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as (typeof TABS)[number]);
          setPage(1);
        }}
      >
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="w-20">Items</TableHead>
                <TableHead className="w-36">Total</TableHead>
                <TableHead className="w-40">Placed</TableHead>
                <TableHead className="w-28">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    No orders {tab !== 'all' ? `with status “${tab}”` : 'yet'}.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => openDetail(o)}>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {o.code}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">
                        {o.customerName || o.buyerName || '—'}
                      </p>
                      {o.buyerEmail && (
                        <p className="text-xs text-muted-foreground">{o.buyerEmail}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.itemCount ?? '—'}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{rupiah(o.total)}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {fmtDate(o.orderedAt ?? o.createdAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{detail?.code}</span>
              {detail && <StatusBadge status={detail.status} />}
            </DialogTitle>
            <DialogDescription>
              {detail?.buyerName}
              {detail?.buyerEmail ? ` · ${detail.buyerEmail}` : ''}
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-4">
              {/* Items */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="w-14">Qty</TableHead>
                      <TableHead className="w-28 text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail.items ?? []).map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="text-sm text-foreground">
                          {it.description}
                          {it.size && (
                            <span className="ml-1 text-xs text-muted-foreground">({it.size})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {it.quantity}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">
                          {rupiah(it.subtotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between text-sm font-semibold text-foreground">
                <span>Total</span>
                <span>{rupiah(detail.total)}</span>
              </div>

              {/* Shipping details */}
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  Ship to
                </p>
                <p className="mt-1 text-foreground">{detail.customerName || '—'}</p>
                <p className="text-muted-foreground">{detail.customerPhone || '—'}</p>
                <p className="text-muted-foreground">{detail.customerAddress || '—'}</p>
                {detail.trackingNumber && (
                  <p className="mt-2 text-foreground">
                    Tracking: <span className="font-mono">{detail.trackingNumber}</span>
                  </p>
                )}
              </div>

              {/* Fulfillment actions */}
              {detail.status === 'paid' && (
                <div className="space-y-2 border-t pt-4">
                  <Label className="text-xs text-muted-foreground">Tracking number</Label>
                  <div className="flex gap-2">
                    <Input
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      placeholder="JNE / SiCepat / …"
                    />
                    <Button
                      disabled={busy || !tracking.trim()}
                      onClick={() => changeStatus('shipped')}
                    >
                      <Truck className="size-4" />
                      Mark shipped
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 border-t pt-4">
                {detail.status === 'shipped' && (
                  <Button disabled={busy} onClick={() => changeStatus('delivered')}>
                    <PackageCheck className="size-4" />
                    Mark delivered
                  </Button>
                )}
                {(detail.status === 'ordered' || detail.status === 'paid') && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    className="text-destructive hover:text-destructive"
                    onClick={() => changeStatus('canceled')}
                  >
                    <XCircle className="size-4" />
                    Cancel order
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
