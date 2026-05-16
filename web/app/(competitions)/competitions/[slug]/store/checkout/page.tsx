'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { useCart } from '@/lib/competitions/use-cart';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TEXTAREA_CLS =
  'flex min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function rupiah(n: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}

export default function CompetitionCheckoutPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);
  const router = useRouter();

  const { comp } = usePortalComp(slug);
  const cart = useCart(slug);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const [placing, setPlacing] = useState(false);
  const [polling, setPolling] = useState(false);
  const [settled, setSettled] = useState(false);
  const orderId = useRef<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const checkStatus = useCallback(async () => {
    if (!orderId.current) return;
    try {
      const r = await emcHttp.get<{ status: string }>(
        `/commerce/orders/${orderId.current}/verify`,
      );
      if (['paid', 'shipped', 'delivered'].includes(r.status)) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setPolling(false);
        setSettled(true);
        cart.clear();
      }
    } catch {
      /* transient — keep polling */
    }
  }, [cart]);

  const placeOrder = async () => {
    if (!comp?.id || cart.items.length === 0) return;
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setErr('Please fill in your name, phone and address.');
      return;
    }
    setErr(null);
    setPlacing(true);
    try {
      const order = await emcHttp.post<{ id: string }>('/commerce/orders', {
        compId: comp.id,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      orderId.current = order.id;

      const res = await emcHttp.post<{ covered?: boolean; redirectUrl?: string }>(
        `/commerce/orders/${order.id}/pay`,
        {},
      );
      if (res.covered) {
        setSettled(true);
        cart.clear();
        return;
      }
      if (res.redirectUrl) {
        window.open(res.redirectUrl, '_blank', 'noopener');
        setPolling(true);
        let tries = 0;
        pollTimer.current = setInterval(() => {
          tries += 1;
          if (tries > 40) {
            if (pollTimer.current) clearInterval(pollTimer.current);
            setPolling(false);
            return;
          }
          void checkStatus();
        }, 4000);
      } else {
        setErr('Could not start payment — please try again.');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to place the order');
    } finally {
      setPlacing(false);
    }
  };

  if (!config) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-xl space-y-6 p-6 lg:p-10">
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
          <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">Checkout</h1>
        </div>

        {err && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {err}
          </div>
        )}

        {settled ? (
          <Card className="items-center gap-3 p-10 text-center">
            <CheckCircle2 className="size-10 text-emerald-600" />
            <h2 className="font-serif text-xl font-medium text-foreground">Order placed</h2>
            <p className="text-sm text-muted-foreground">
              Your payment is confirmed — track it under My orders.
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" asChild>
                <Link href={paths.store}>Back to store</Link>
              </Button>
              <Button onClick={() => router.replace(`${paths.store}/orders`)}>My orders</Button>
            </div>
          </Card>
        ) : !cart.ready ? (
          <Card className="items-center gap-3 p-10 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </Card>
        ) : cart.items.length === 0 ? (
          <Card className="gap-2 p-8 text-center">
            <h2 className="font-serif text-xl font-medium text-foreground">Your cart is empty</h2>
            <Button variant="outline" className="mx-auto mt-3 w-fit" asChild>
              <Link href={paths.store}>Browse the store</Link>
            </Button>
          </Card>
        ) : (
          <Card className="gap-0 p-7">
            {/* Order summary */}
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Order summary
            </p>
            <div className="mt-3 space-y-1.5 text-sm">
              {cart.items.map((it) => (
                <div key={it.productId} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {it.name} <span className="text-muted-foreground/70">× {it.quantity}</span>
                  </span>
                  <span className="tabular-nums text-foreground">
                    {rupiah(it.price * it.quantity)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 text-base font-semibold text-foreground">
                <span>Total</span>
                <span>{rupiah(cart.total)}</span>
              </div>
            </div>

            {/* Shipping details */}
            <div className="mt-6 space-y-4 border-t pt-5">
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">
                  Recipient name <span className="text-destructive">*</span>
                </Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">
                  Phone <span className="text-destructive">*</span>
                </Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+62…" />
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">
                  Shipping address <span className="text-destructive">*</span>
                </Label>
                <textarea
                  className={TEXTAREA_CLS}
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, city, postal code"
                />
              </div>
            </div>

            {polling ? (
              <div className="mt-6 rounded-md bg-primary/5 px-4 py-3 text-sm text-primary">
                <p className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Waiting for your payment to complete…
                </p>
                <p className="mt-1 text-xs text-primary/80">
                  Finish the payment in the tab that opened. This page updates automatically.
                </p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => void checkStatus()}>
                  I’ve paid — check now
                </Button>
              </div>
            ) : (
              <Button className="mt-6 w-full" size="lg" onClick={placeOrder} disabled={placing}>
                {placing ? 'Placing order…' : `Place order · ${rupiah(cart.total)}`}
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
