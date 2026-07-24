"use client";

import { ProductImage } from "@/components/products/product-image";
import type { Product } from "@/lib/data/products";

/**
 * Product imagery on the detail page. Uses the product's own representative
 * image (the category-themed placeholder generated in the seed) so the detail
 * view always matches the listing card — no separate/random image source.
 */
export function ProductGallery({ product }: { product: Product }) {
  return (
    <ProductImage
      src={product.image}
      alt={product.name}
      category={product.category}
      className="aspect-square w-full rounded-xl border border-border"
      iconSize={64}
    />
  );
}
