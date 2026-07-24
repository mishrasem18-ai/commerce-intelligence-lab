"use client";

import { ToastProvider } from "@/components/ui/toast";
import { ProductsProvider } from "@/lib/store/products-store";
import { OrdersProvider } from "@/lib/store/orders-store";
import { CustomersProvider } from "@/lib/store/customers-store";
import { CartProvider } from "@/lib/store/cart-store";
import { AuthProvider } from "@/lib/store/auth-store";
import type { Product } from "@/lib/data/products";
import type { Customer, Order } from "@/lib/data";

/**
 * One logical commerce data layer shared by the storefront and the admin.
 * Initial product/order/customer data is read from D1 on the server (in the
 * root layout) and passed in here — the stores are D1-backed, not static.
 * Order matters: AuthProvider depends on CustomersProvider (signup creates a
 * customer), so it must be nested inside it.
 */
export function Providers({
  children,
  initialProducts,
  initialOrders,
  initialCustomers,
}: {
  children: React.ReactNode;
  initialProducts: Product[];
  initialOrders: Order[];
  initialCustomers: Customer[];
}) {
  return (
    <ToastProvider>
      <ProductsProvider initial={initialProducts}>
        <OrdersProvider initial={initialOrders}>
          <CustomersProvider initial={initialCustomers}>
            <CartProvider>
              <AuthProvider>{children}</AuthProvider>
            </CartProvider>
          </CustomersProvider>
        </OrdersProvider>
      </ProductsProvider>
    </ToastProvider>
  );
}
