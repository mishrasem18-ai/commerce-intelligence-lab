"use client";

import * as React from "react";
import { orders as seedOrders, type Order, type OrderStatus } from "@/lib/data";

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

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = React.useState<Order[]>(seedOrders);
  const [hydrated, setHydrated] = React.useState(false);

  // Hydration must happen post-mount so the server-rendered seed matches the
  // client's first render; reading storage during render would diverge.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Order[];
        if (Array.isArray(parsed) && parsed.length > 0) setOrders(parsed);
      }
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [orders, hydrated]);

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
