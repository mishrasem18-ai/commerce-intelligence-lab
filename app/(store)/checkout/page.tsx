import type { Metadata } from "next";
import { CheckoutView } from "@/components/store/checkout-view";

export const metadata: Metadata = { title: { absolute: "Checkout · Aurora Market" } };

export default function CheckoutPage() {
  return <CheckoutView />;
}
