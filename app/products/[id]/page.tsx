import type { Metadata } from "next";
import { ProductDetailView } from "@/components/products/product-detail-view";
import { getProductById, products } from "@/lib/data/products";

// Statically pre-render the known catalog; allow other ids (e.g. products
// created or duplicated at runtime in the client store) to render on demand.
export const dynamicParams = true;

export function generateStaticParams() {
  return products.map((product) => ({ id: product.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = getProductById(id);
  return { title: product ? product.name : "Product" };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProductById(id) ?? null;

  return <ProductDetailView id={id} initialProduct={product} />;
}
