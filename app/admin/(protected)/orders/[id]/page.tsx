import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { routeMetadata } from "@/lib/routes/page-titles";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { currentAdminSession } from "@/lib/auth/guards";
import { getOrderForAdmin } from "@/lib/db/admin-data";

// Served on demand from D1, so an order placed after the admin list was
// loaded still resolves.
export const dynamic = "force-dynamic";

// Fixed per-template title (no ids, no names): see lib/routes/page-titles.ts.
export const metadata: Metadata = routeMetadata("admin_order_detail");

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await currentAdminSession())) redirect("/admin/login");
  const { id } = await params;
  return <OrderDetailView slug={id} initialOrder={await getOrderForAdmin(id)} />;
}
