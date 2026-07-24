import type { Metadata } from "next";
import { BuyerOrderDetailView } from "@/components/store/buyer-order-detail-view";

export const metadata: Metadata = { title: { absolute: "Order · Aurora Market" } };

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BuyerOrderDetailView slug={id} />;
}
