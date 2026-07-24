import type { Metadata } from "next";
import { BuyerProductDetail } from "@/components/store/buyer-product-detail";
import { getProductById, products } from "@/lib/data/products";

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
  const product = getProductById(id) ?? null;
  return <BuyerProductDetail id={id} initialProduct={product} />;
}
