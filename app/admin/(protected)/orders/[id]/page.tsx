import type { Metadata } from "next";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { orders } from "@/lib/data";

// Seed orders are prerendered; buyer-created orders (client store) render on demand.
export const dynamicParams = true;

function findSeedOrder(slug: string) {
  return orders.find((order) => order.id.replace(/^#/, "") === slug) ?? null;
}

export function generateStaticParams() {
  return orders.map((order) => ({ id: order.id.replace(/^#/, "") }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const order = findSeedOrder(id);
  return { title: order ? `Order ${order.id}` : "Order" };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderDetailView slug={id} initialOrder={findSeedOrder(id)} />;
}
