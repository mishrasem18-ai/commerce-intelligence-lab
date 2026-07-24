"use client";

import * as React from "react";
import { type Order, type OrderStatus } from "@/lib/data";

const STORAGE_KEY = "cil.orders.v1";

interface OrdersContextValue {
  orders: Order[];
  hydrated: boolean;
  getOrder: (id: string) => Order | undefined;
  updateStatus: (id: string, status: OrderStatus) => void;
  addOrder: (order: Order) => void;
}

const OrdersContext = React.createContext<OrdersContextValue | null>(null);

export function useOrders(): OrdersContextValue {
  const ctx = React.useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within <OrdersProvider>");
  return ctx;
}

export function OrdersProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: Order[];
}) {
  // Seed orders come from D1 (server-provided `initial`). Buyer-placed orders
  // are kept in a localStorage overlay until write-through (Phase D/E).
  const [orders, setOrders] = React.useState<Order[]>(initial);
  const [hydrated, setHydrated] = React.useState(false);
  const d1Ids = React.useMemo(() => new Set(initial.map((o) => o.id)), [initial]);

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const overlay = (JSON.parse(raw) as Order[]).filter((o) => !d1Ids.has(o.id));
        if (overlay.length > 0) setOrders([...overlay, ...initial]);
      }
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist ONLY buyer-created orders (ids not in D1).
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      const overlay = orders.filter((o) => !d1Ids.has(o.id));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [orders, hydrated, d1Ids]);

  const getOrder = React.useCallback(
    (id: string) => orders.find((order) => order.id === id),
    [orders],
  );

  const updateStatus = React.useCallback((id: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === id ? { ...order, status } : order)),
    );
  }, []);

  const addOrder = React.useCallback((order: Order) => {
    setOrders((prev) => [order, ...prev]);
  }, []);

  const value = React.useMemo<OrdersContextValue>(
    () => ({ orders, hydrated, getOrder, updateStatus, addOrder }),
    [orders, hydrated, getOrder, updateStatus, addOrder],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}
