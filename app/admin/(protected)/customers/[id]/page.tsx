import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { CustomerDetailView } from "@/components/customers/customer-detail-view";
import { getCustomerById } from "@/lib/db/customers";

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
  const { id } = await params;
  return <CustomerDetailView id={id} initialCustomer={await getCustomerById(id)} />;
}
