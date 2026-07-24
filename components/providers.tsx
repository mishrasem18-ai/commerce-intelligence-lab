"use client";

import { ToastProvider } from "@/components/ui/toast";
import { ProductsProvider } from "@/lib/store/products-store";
import { OrdersProvider } from "@/lib/store/orders-store";

/** Client-side application state: toasts + mock data stores. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ProductsProvider>
        <OrdersProvider>{children}</OrdersProvider>
      </ProductsProvider>
    </ToastProvider>
  );
}
