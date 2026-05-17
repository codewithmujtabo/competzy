'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, ImageIcon, Loader2, Minus, Plus, Receipt, ShoppingCart } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { useCart } from '@/lib/competitions/use-cart';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface StoreProduct {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image: string | null;
}

function rupiah(n: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}

export default function CompetitionStorePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);

  const { comp } = usePortalComp(slug);
  const cart = useCart(slug);
  const [products, setProducts] = useState<StoreProduct[] | null>(null);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  useEffect(() => {
    if (!comp?.id) return;
    emcHttp
      .get<StoreProduct[]>(`/commerce/storefront/products?compId=${encodeURIComponent(comp.id)}`)
      .then(setProducts)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load the store');
        setProducts([]);
      });
  }, [comp?.id]);

  if (!config) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
            <Link href={paths.dashboard}>
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`${paths.store}/orders`}>
              <Receipt className="size-4" />
              My orders
            </Link>
          </Button>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
            {config.shortName} 2026
          </p>
          <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">Official store</h1>
        </div>

        {/* Cart summary */}
        {cart.ready && cart.items.length > 0 && (
          <Card className="gap-0 p-5">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <ShoppingCart className="size-3.5" />
              Your cart · {cart.count} item{cart.count === 1 ? '' : 's'}
            </p>
            <div className="mt-3 space-y-2">
              {cart.items.map((it) => (
                <div key={it.productId} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate text-foreground">{it.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-7"
                      onClick={() => cart.setQty(it.productId, it.quantity - 1)}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-7 text-center tabular-nums">{it.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-7"
                      onClick={() => cart.setQty(it.productId, it.quantity + 1)}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                  <span className="w-28 text-right tabular-nums text-foreground">
                    {rupiah(it.price * it.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <span className="text-sm font-semibold text-foreground">
                Total {rupiah(cart.total)}
              </span>
              <Button asChild>
                <Link href={`${paths.store}/checkout`}>Checkout</Link>
              </Button>
            </div>
          </Card>
        )}

        {/* Product grid */}
        {!products ? (
          <Card className="items-center gap-3 p-10 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading the store…</p>
          </Card>
        ) : products.length === 0 ? (
          <Card className="gap-1 p-10 text-center">
            <h2 className="font-serif text-lg font-medium text-foreground">No items yet</h2>
            <p className="text-sm text-muted-foreground">
              This competition’s store has no products on sale right now.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Card key={p.id} className="gap-0 overflow-hidden p-0">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt={p.name}
                    className="aspect-[4/3] w-full bg-muted object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground">
                    <ImageIcon className="size-7" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-4">
                  <p className="font-medium text-foreground">{p.name}</p>
                  {p.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  <p className="mt-2 text-sm font-semibold text-foreground">{rupiah(p.price)}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      cart.add({ productId: p.id, name: p.name, price: p.price, image: p.image });
                      toast.success(`${p.name} added to cart.`);
                    }}
                  >
                    <Plus className="size-3.5" />
                    Add to cart
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
