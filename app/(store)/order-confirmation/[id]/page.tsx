import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { OrderConfirmationView } from "@/components/store/order-confirmation-view";

export const metadata: Metadata = routeMetadata("order_confirmation");

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderConfirmationView slug={id} />;
}
