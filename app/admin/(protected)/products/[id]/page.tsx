import type { Metadata } from "next";
import { ProductDetailView } from "@/components/products/product-detail-view";
import { getProductById } from "@/lib/db/products";

// Products are served on demand from D1; runtime-created products (client
// overlay) resolve via the store when not present in D1.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  return { title: product ? product.name : "Product" };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailView id={id} initialProduct={await getProductById(id)} />;
}
