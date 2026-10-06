import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { routeMetadata } from "@/lib/routes/page-titles";
import { CustomerDetailView } from "@/components/customers/customer-detail-view";
import { currentAdminSession } from "@/lib/auth/guards";
import { getCustomerForAdmin } from "@/lib/db/admin-data";

// Customers are served on demand from D1; buyer signups (client overlay)
// resolve via the store when not present in D1.
export const dynamic = "force-dynamic";

// Fixed per-template title (no ids, no names): see lib/routes/page-titles.ts.
export const metadata: Metadata = routeMetadata("admin_customer_detail");

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await currentAdminSession())) redirect("/admin/login");
  const { id } = await params;
  return <CustomerDetailView id={id} initialCustomer={await getCustomerForAdmin(id)} />;
}
