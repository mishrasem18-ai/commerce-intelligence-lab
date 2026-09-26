import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { CartView } from "@/components/store/cart-view";

export const metadata: Metadata = routeMetadata("cart");

export default function CartPage() {
  return <CartView />;
}
