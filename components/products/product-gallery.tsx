"use client";

import * as React from "react";
import { ProductImage } from "@/components/products/product-image";
import type { Product } from "@/lib/data/products";
import { cn } from "@/lib/utils";

/** Build a small deterministic gallery from the product's placeholder seed. */
function galleryImages(product: Product): string[] {
  return [product.sku, `${product.sku}-b`, `${product.sku}-c`, `${product.sku}-d`].map(
    (seed) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/800`,
  );
}

export function ProductGallery({ product }: { product: Product }) {
  const images = galleryImages(product);
  const [active, setActive] = React.useState(0);

  return (
    <div className="flex flex-col gap-3">
      <ProductImage
        key={active}
        src={images[active]}
        alt={`${product.name} — view ${active + 1}`}
        category={product.category}
        className="aspect-square w-full rounded-xl border border-border"
        iconSize={64}
      />
      <div className="grid grid-cols-4 gap-3">
        {images.map((src, index) => (
          <button
            key={src}
            type="button"
            aria-label={`View image ${index + 1}`}
            aria-pressed={index === active}
            onClick={() => setActive(index)}
            className={cn(
              "overflow-hidden rounded-lg border transition-all",
              index === active
                ? "border-primary ring-2 ring-ring/25"
                : "border-border hover:border-muted-foreground/40",
            )}
          >
            <ProductImage
              src={src}
              alt={`${product.name} thumbnail ${index + 1}`}
              category={product.category}
              className="aspect-square w-full"
              iconSize={20}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
