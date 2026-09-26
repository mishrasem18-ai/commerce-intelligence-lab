"use client";

import { ProductImage } from "@/components/products/product-image";
import type { Product } from "@/lib/data/products";
import type { ProductImageUsage } from "@/lib/catalog/product-images";

/**
 * Product imagery on the detail page. Uses the product's own representative
 * image (shared by its product type) so the detail view always matches the
 * listing card — no separate/random image source.
 */
export function ProductGallery({
  product,
  usage,
  priority = false,
}: {
  product: Product;
  usage: Extract<ProductImageUsage, "pdpGallery" | "adminGallery">;
  /** The store PDP main image is the page's LCP candidate. */
  priority?: boolean;
}) {
  return (
    <ProductImage
      src={product.image}
      alt={product.name}
      category={product.category}
      usage={usage}
      priority={priority}
      className="aspect-square w-full rounded-xl border border-border"
      iconSize={64}
    />
  );
}
