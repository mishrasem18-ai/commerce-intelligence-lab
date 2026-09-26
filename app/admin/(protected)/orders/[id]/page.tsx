import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { getOrderByNumber } from "@/lib/db/orders";

// Orders are served on demand from D1; buyer-created orders (client overlay)
// resolve via the store when not present in D1.
export const dynamic = "force-dynamic";

// Fixed per-template title (no ids, no names): see lib/routes/page-titles.ts.
export const metadata: Metadata = routeMetadata("admin_order_detail");

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderDetailView slug={id} initialOrder={await getOrderByNumber(id)} />;
}
