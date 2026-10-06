"use client";

import { useAuth } from "@/lib/store/auth-store";
import { useBuyerOrders } from "@/lib/hooks/use-buyer-orders";
import type { Order } from "@/lib/data";

export type BuyerOrderResult =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "unauthorized" }
  | { status: "error"; retry: () => void }
  | { status: "ok"; order: Order };

/**
 * Resolves one of the signed-in buyer's own orders by its number/slug.
 *
 * The orders come from the server already scoped to the session's buyer, so
 * another customer's order number resolves to "not-found" — its data is never
 * in the browser.
 */
export function useBuyerOrder(slug: string): BuyerOrderResult {
  const { buyer, buyerStatus } = useAuth();
  const { orders, status, reload } = useBuyerOrders();

  // "loading" only while a request is genuinely in flight; a failed session
  // resolves to unauthorized rather than a permanent spinner.
  if (buyerStatus === "loading") return { status: "loading" };
  if (!buyer) return { status: "unauthorized" };

  const order = orders.find(
    (o) =>
      o.customerId === buyer.customerId &&
      (o.orderNumber === slug || o.id.replace(/^#/, "") === slug),
  );
  // An order mirrored from checkout is shown at once, before the list loads.
  if (order) return { status: "ok", order };
  if (status === "error") return { status: "error", retry: reload };
  if (status !== "ready") return { status: "loading" };
  return { status: "not-found" };
}
