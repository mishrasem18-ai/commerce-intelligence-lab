import type { Metadata } from "next";
import { CustomerDetailView } from "@/components/customers/customer-detail-view";
import { getCustomerById } from "@/lib/db/customers";

// Customers are served on demand from D1; buyer signups (client overlay)
// resolve via the store when not present in D1.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const customer = await getCustomerById(id);
  return { title: customer ? customer.name : "Customer" };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerDetailView id={id} initialCustomer={await getCustomerById(id)} />;
}
