import type { Metadata } from "next";
import { BuyerProductDetail } from "@/components/store/buyer-product-detail";
import { getProductById } from "@/lib/db/products";

// Product detail is served on demand from D1 (no build-time static params).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  return {
    title: {
      absolute: product ? `${product.name} · Aurora Market` : "Product · Aurora Market",
    },
  };
}

export default async function BuyerProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);
  return <BuyerProductDetail id={id} initialProduct={product} />;
}
