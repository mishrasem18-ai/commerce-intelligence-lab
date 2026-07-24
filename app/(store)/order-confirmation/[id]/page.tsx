import type { Metadata } from "next";
import { OrderConfirmationView } from "@/components/store/order-confirmation-view";

export const metadata: Metadata = {
  title: { absolute: "Order Confirmation · Aurora Market" },
};

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderConfirmationView slug={id} />;
}
