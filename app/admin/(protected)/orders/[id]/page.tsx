import type { Metadata } from "next";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { getOrderByNumber } from "@/lib/db/orders";

// Orders are served on demand from D1; buyer-created orders (client overlay)
// resolve via the store when not present in D1.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const order = await getOrderByNumber(id);
  return { title: order ? `Order ${order.id}` : "Order" };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderDetailView slug={id} initialOrder={await getOrderByNumber(id)} />;
}
