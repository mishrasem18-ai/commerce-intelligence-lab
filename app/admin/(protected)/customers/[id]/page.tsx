import type { Metadata } from "next";
import { CustomerDetailView } from "@/components/customers/customer-detail-view";
import { customers } from "@/lib/data";

// Seed customers are prerendered; buyer signups (client store) render on demand.
export const dynamicParams = true;

export function generateStaticParams() {
  return customers.map((customer) => ({ id: customer.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const customer = customers.find((c) => c.id === id);
  return { title: customer ? customer.name : "Customer" };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = customers.find((c) => c.id === id) ?? null;
  return <CustomerDetailView id={id} initialCustomer={customer} />;
}
