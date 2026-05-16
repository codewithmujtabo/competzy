'use client';

// A per-competition shopping cart, persisted to localStorage so it survives
// navigation between the store, the checkout page, and a refresh.
// Key: competzy.cart.<slug>

import { useEffect, useState } from 'react';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
}

export function useCart(slug: string) {
  const key = `competzy.cart.${slug}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setItems(raw ? (JSON.parse(raw) as CartItem[]) : []);
    } catch {
      setItems([]);
    }
    setReady(true);
  }, [key]);

  const persist = (next: CartItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* storage unavailable — cart stays in memory */
    }
  };

  const add = (p: Omit<CartItem, 'quantity'>) => {
    const existing = items.find((i) => i.productId === p.productId);
    persist(
      existing
        ? items.map((i) =>
            i.productId === p.productId ? { ...i, quantity: i.quantity + 1 } : i,
          )
        : [...items, { ...p, quantity: 1 }],
    );
  };

  const setQty = (productId: string, quantity: number) => {
    persist(
      quantity <= 0
        ? items.filter((i) => i.productId !== productId)
        : items.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
    );
  };

  const remove = (productId: string) =>
    persist(items.filter((i) => i.productId !== productId));

  const clear = () => persist([]);

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return { items, ready, add, setQty, remove, clear, total, count };
}
