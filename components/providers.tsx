"use client";

import * as React from "react";
import { ToastProvider } from "@/components/ui/toast";
import { ProductsProvider } from "@/lib/store/products-store";
import { CartProvider } from "@/lib/store/cart-store";
import { BuyerAccountProvider } from "@/lib/store/buyer-account-store";
import { AuthProvider } from "@/lib/store/auth-store";
import type { Product } from "@/lib/data/products";

/**
 * Earlier builds kept browser copies of orders and customers under these
 * localStorage keys. Nothing reads them any more — orders and sign-ups are
 * written to D1 — and they could leave a previous buyer's email and address
 * behind on a shared browser, so they are deleted on load.
 */
const LEGACY_STORAGE_KEYS = ["cil.orders.v1", "cil.customers.v1"];

/**
 * The client stores every route shares: the catalog, the cart, the signed-in
 * buyer's own account and the auth state. The catalog is read from D1 on the
 * server (in the root layout) and passed in here. These providers render for
 * every visitor, so nothing but public data may be passed to them — the full
 * order and customer lists are mounted only inside the admin layout. The one
 * exception is `buyerCustomerId`: the signed-in buyer's own opaque id, which
 * the server sends to that buyer only, for analytics.
 * Order matters: AuthProvider hands the signed-in buyer's profile to
 * BuyerAccountProvider, so it must be nested inside it.
 */
export function Providers({
  children,
  initialProducts,
  buyerCustomerId,
}: {
  children: React.ReactNode;
  initialProducts: Product[];
  /** Customer id of the D1-validated buyer session of this request, or null. */
  buyerCustomerId: string | null;
}) {
  React.useEffect(() => {
    try {
      for (const key of LEGACY_STORAGE_KEYS) window.localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return (
    <ToastProvider>
      <ProductsProvider initial={initialProducts}>
        <CartProvider>
          <BuyerAccountProvider>
            <AuthProvider serverCustomerId={buyerCustomerId}>{children}</AuthProvider>
          </BuyerAccountProvider>
        </CartProvider>
      </ProductsProvider>
    </ToastProvider>
  );
}
