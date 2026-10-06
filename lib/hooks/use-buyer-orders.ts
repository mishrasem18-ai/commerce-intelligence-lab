"use client";

import * as React from "react";
import { useAuth } from "@/lib/store/auth-store";
import { useBuyerAccount, type BuyerOrdersStatus } from "@/lib/store/buyer-account-store";
import type { Order } from "@/lib/data";

/**
 * The signed-in buyer's own orders, loaded from the server the first time a
 * screen asks for them. `status` settles to ready or error once the request
 * has finished — a screen can never be left on "loading".
 */
export function useBuyerOrders(): {
  orders: Order[];
  status: BuyerOrdersStatus;
  reload: () => void;
} {
  const { buyer, buyerStatus } = useAuth();
  const { orders, ordersStatus, loadOrders } = useBuyerAccount();
  const customerId = buyerStatus === "authenticated" ? buyer?.customerId : undefined;

  React.useEffect(() => {
    if (customerId && ordersStatus === "idle") void loadOrders(customerId);
  }, [customerId, ordersStatus, loadOrders]);

  const reload = React.useCallback(() => {
    if (customerId) void loadOrders(customerId);
  }, [customerId, loadOrders]);

  return { orders, status: ordersStatus, reload };
}
