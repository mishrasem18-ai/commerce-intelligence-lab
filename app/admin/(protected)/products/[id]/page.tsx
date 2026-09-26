import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { ProductDetailView } from "@/components/products/product-detail-view";
import { getProductById } from "@/lib/db/products";

// Products are served on demand from D1; runtime-created products (client
// overlay) resolve via the store when not present in D1.
export const dynamic = "force-dynamic";

// Fixed per-template title (no ids, no names): see lib/routes/page-titles.ts.
export const metadata: Metadata = routeMetadata("admin_product_detail");

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailView id={id} initialProduct={await getProductById(id)} />;
}
