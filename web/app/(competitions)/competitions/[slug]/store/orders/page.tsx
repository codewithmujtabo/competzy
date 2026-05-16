'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, ShoppingBag } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface StorefrontOrder {
  id: string;
  code: string;
  status: string;
  total: number;
  itemCount?: number;
  compName?: string;
  trackingNumber: string | null;
  orderedAt: string | null;
  createdAt: string;
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
  return new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CompetitionStoreOrdersPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);

  const [orders, setOrders] = useState<StorefrontOrder[] | null>(null);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  useEffect(() => {
    emcHttp
      .get<StorefrontOrder[]>('/commerce/storefront/orders')
      .then(setOrders)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load your orders');
        setOrders([]);
      });
  }, []);

  if (!config) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-10">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href={paths.store}>
            <ArrowLeft className="size-4" />
            Back to store
          </Link>
        </Button>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
            {config.shortName} 2026
          </p>
          <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">My orders</h1>
        </div>

        {!orders ? (
          <Card className="items-center gap-3 p-10 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </Card>
        ) : orders.length === 0 ? (
          <Card className="items-center gap-2 p-10 text-center">
            <ShoppingBag className="size-7 text-muted-foreground" />
            <h2 className="font-serif text-lg font-medium text-foreground">No orders yet</h2>
            <p className="text-sm text-muted-foreground">
              Items you order from the store will show up here.
            </p>
            <Button variant="outline" className="mt-2" asChild>
              <Link href={paths.store}>Browse the store</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <Card key={o.id} className="gap-0 p-5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs text-muted-foreground">{o.code}</p>
                  <Badge
                    variant="outline"
                    className={`border-transparent font-mono text-[10px] capitalize ${STATUS_STYLE[o.status] ?? 'bg-muted text-muted-foreground'}`}
                  >
                    {o.status}
                  </Badge>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <div className="text-sm text-muted-foreground">
                    {o.compName && <p className="text-foreground">{o.compName}</p>}
                    <p>
                      {o.itemCount ?? 0} item{o.itemCount === 1 ? '' : 's'} ·{' '}
                      {fmtDate(o.orderedAt ?? o.createdAt)}
                    </p>
                    {o.trackingNumber && (
                      <p className="font-mono text-xs">Tracking: {o.trackingNumber}</p>
                    )}
                  </div>
                  <p className="text-base font-semibold text-foreground">{rupiah(o.total)}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
