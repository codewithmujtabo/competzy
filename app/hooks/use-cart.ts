import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// A per-competition shopping cart, persisted to AsyncStorage so it survives
// navigation between the store / cart / checkout screens and app restarts.
// Key: competzy.cart.<compId>. A direct port of the web `use-cart` hook —
// AsyncStorage is async, hence the `ready` flag while it hydrates.

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
}

export function useCart(compId: string) {
  const key = `competzy.cart.${compId}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setItems([]);
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (cancelled) return;
        try {
          setItems(raw ? (JSON.parse(raw) as CartItem[]) : []);
        } catch {
          setItems([]);
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const persist = (next: CartItem[]) => {
    setItems(next);
    AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {
      /* storage unavailable — cart stays in memory */
    });
  };

  const add = (p: Omit<CartItem, "quantity">) => {
    const existing = items.find((i) => i.productId === p.productId);
    persist(
      existing
        ? items.map((i) =>
            i.productId === p.productId ? { ...i, quantity: i.quantity + 1 } : i
          )
        : [...items, { ...p, quantity: 1 }]
    );
  };

  const setQty = (productId: string, quantity: number) => {
    persist(
      quantity <= 0
        ? items.filter((i) => i.productId !== productId)
        : items.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  };

  const remove = (productId: string) =>
    persist(items.filter((i) => i.productId !== productId));

  const clear = () => persist([]);

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return { items, ready, add, setQty, remove, clear, total, count };
}
