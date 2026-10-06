"use client";

import { ToastProvider } from "@/components/ui/toast";
import { ProductsProvider } from "@/lib/store/products-store";
import { CartProvider } from "@/lib/store/cart-store";
import { BuyerAccountProvider } from "@/lib/store/buyer-account-store";
import { AuthProvider } from "@/lib/store/auth-store";
import type { Product } from "@/lib/data/products";

/**
 * The client stores every route shares: the catalog, the cart, the signed-in
 * buyer's own account and the auth state. The catalog is read from D1 on the
 * server (in the root layout) and passed in here. These providers render for
 * every visitor, so nothing but public data may be passed to them — the full
 * order and customer lists are mounted only inside the admin layout.
 * Order matters: AuthProvider hands the signed-in buyer's profile to
 * BuyerAccountProvider, so it must be nested inside it.
 */
export function Providers({
  children,
  initialProducts,
}: {
  children: React.ReactNode;
  initialProducts: Product[];
}) {
  return (
    <ToastProvider>
      <ProductsProvider initial={initialProducts}>
        <CartProvider>
          <BuyerAccountProvider>
            <AuthProvider>{children}</AuthProvider>
          </BuyerAccountProvider>
        </CartProvider>
      </ProductsProvider>
    </ToastProvider>
  );
}
