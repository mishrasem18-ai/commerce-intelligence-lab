"use client";

import { ToastProvider } from "@/components/ui/toast";
import { ProductsProvider } from "@/lib/store/products-store";
import { OrdersProvider } from "@/lib/store/orders-store";
import { CustomersProvider } from "@/lib/store/customers-store";
import { CartProvider } from "@/lib/store/cart-store";
import { AuthProvider } from "@/lib/store/auth-store";

/**
 * One logical commerce data layer shared by the storefront and the admin.
 * Order matters: AuthProvider depends on CustomersProvider (signup creates a
 * customer), so it must be nested inside it.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ProductsProvider>
        <OrdersProvider>
          <CustomersProvider>
            <CartProvider>
              <AuthProvider>{children}</AuthProvider>
            </CartProvider>
          </CustomersProvider>
        </OrdersProvider>
      </ProductsProvider>
    </ToastProvider>
  );
}
