"use client";

import * as React from "react";
import { type Order, type OrderStatus } from "@/lib/data";

/*
 * ADMIN ONLY. Every customer's orders, seeded from D1 by the (protected) admin
 * layout after its server-side session check. Never mount this provider on a
 * route a buyer or an anonymous visitor can reach: whatever it is seeded with
 * is sent to the browser. The storefront uses the buyer account store, which
 * holds only the signed-in buyer's own orders.
 */

interface OrdersContextValue {
  orders: Order[];
  /** Change an order's status for this admin session (not written to D1 yet). */
  updateStatus: (id: string, status: OrderStatus) => void;
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
  const [orders, setOrders] = React.useState<Order[]>(initial);

  const updateStatus = React.useCallback((id: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === id ? { ...order, status } : order)),
    );
  }, []);

  const value = React.useMemo<OrdersContextValue>(
    () => ({ orders, updateStatus }),
    [orders, updateStatus],
  );

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}
