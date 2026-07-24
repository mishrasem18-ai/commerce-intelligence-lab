"use client";

import { useOrders } from "@/lib/store/orders-store";
import { useAuth } from "@/lib/store/auth-store";
import type { Order } from "@/lib/data";

export type BuyerOrderResult =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "unauthorized" }
  | { status: "ok"; order: Order };

/** Resolves an order by its number/slug and enforces buyer ownership. */
export function useBuyerOrder(slug: string): BuyerOrderResult {
  const { orders, hydrated } = useOrders();
  const { buyer, hydrated: authHydrated } = useAuth();

  if (!hydrated || !authHydrated) return { status: "loading" };

  const order = orders.find(
    (o) => o.orderNumber === slug || o.id.replace(/^#/, "") === slug,
  );
  if (!order) return { status: "not-found" };

  // A buyer may only see their own orders — never another customer's.
  if (!buyer || order.customerId !== buyer.customerId) {
    return { status: "unauthorized" };
  }
  return { status: "ok", order };
}
