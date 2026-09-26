import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { BuyerOrderDetailView } from "@/components/store/buyer-order-detail-view";

export const metadata: Metadata = routeMetadata("account_order_detail");

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BuyerOrderDetailView slug={id} />;
}
