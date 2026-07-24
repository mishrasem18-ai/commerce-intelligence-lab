import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { orders } from "@/lib/data";

export const dynamicParams = false;

function findOrder(slug: string) {
  return orders.find((order) => order.id.replace(/^#/, "") === slug);
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
  const order = findOrder(id);
  return { title: order ? `Order ${order.id}` : "Order not found" };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = findOrder(id);

  if (!order) notFound();

  return <OrderDetailView initialOrder={order} />;
}
