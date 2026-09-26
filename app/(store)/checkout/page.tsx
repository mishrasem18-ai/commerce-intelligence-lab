import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { CheckoutView } from "@/components/store/checkout-view";

export const metadata: Metadata = routeMetadata("checkout");

export default function CheckoutPage() {
  return <CheckoutView />;
}
