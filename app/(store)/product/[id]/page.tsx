import { cache } from "react";
import type { Metadata } from "next";
import { BuyerProductDetail } from "@/components/store/buyer-product-detail";
import { getProductById } from "@/lib/db/products";
import { isPurchasable } from "@/lib/commerce";
import { productPageTitle } from "@/lib/routes/page-titles";

// Product detail is served on demand from D1 (no build-time static params).
export const dynamic = "force-dynamic";

// One D1 read per request, shared by generateMetadata and the page.
const loadProduct = cache(getProductById);

/**
 * The PDP is the only entity title. Metadata and the client registration
 * (BuyerProductDetail → useRegisterPageTitle) both use productPageTitle(),
 * so the <title> and the tracked page.title can never drift apart.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);
  return {
    title: {
      absolute: productPageTitle(product && isPurchasable(product) ? product.name : null),
    },
  };
}

export default async function BuyerProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await loadProduct(id);
  return <BuyerProductDetail id={id} initialProduct={product} />;
}
