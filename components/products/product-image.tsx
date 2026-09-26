"use client";

/*
 * A plain <img> is used deliberately (instead of next/image) so the module
 * needs no remote-host configuration and stays portable across the Cloudflare
 * deployment target. Responsive AVIF/WebP variants come from the build-time
 * pipeline (scripts/build-product-images.mjs) via <picture>.
 */
/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import type { ProductCategory } from "@/lib/data/products";
import { CATEGORY_GRADIENT, CATEGORY_ICON } from "@/components/products/category-visuals";
import {
  PRODUCT_IMAGE_SIZES,
  resolveProductImage,
  type ProductImageUsage,
} from "@/lib/catalog/product-images";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  /** The product's `image`: a key from the image pipeline, or a URL/data URI. */
  src: string;
  alt: string;
  category: ProductCategory;
  /** Where the image is rendered — selects the `sizes` hint. */
  usage: ProductImageUsage;
  /**
   * Above-the-fold hero (PDP main image, first grid row): eager +
   * fetchpriority="high". Everything else is lazy + async-decoded.
   */
  priority?: boolean;
  className?: string;
  /** Size of the fallback icon, in px. */
  iconSize?: number;
}

/**
 * Product image with a category-tinted gradient + icon fallback. The frame
 * reserves its box via the caller's aspect/size classes and the <img> carries
 * explicit width/height, so loading never shifts layout (CLS 0). The image is
 * visible as soon as the browser paints it — no JS-gated fade-in — so LCP
 * never waits for hydration; the dominant colour fills the frame meanwhile.
 */
export function ProductImage({
  src,
  alt,
  category,
  usage,
  priority = false,
  className,
  iconSize = 28,
}: ProductImageProps) {
  const [erroredSrc, setErroredSrc] = React.useState<string | null>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const resolved = resolveProductImage(src);
  const failed = resolved.kind === "none" || erroredSrc === src;
  const Icon = CATEGORY_ICON[category];

  // An image that failed before hydration never reports onError to React —
  // reconcile from the element's state once mounted.
  React.useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setErroredSrc(src);
  }, [src]);

  const loading = priority ? "eager" : "lazy";
  const fetchPriority = priority ? "high" : "auto";
  const onError = () => setErroredSrc(src);

  return (
    <div
      className={cn("relative overflow-hidden bg-muted", className)}
      style={resolved.kind === "responsive" && !failed ? { backgroundColor: resolved.color } : undefined}
    >
      {!failed && resolved.kind === "responsive" && (
        <picture>
          <source type="image/avif" srcSet={resolved.avifSrcSet} sizes={PRODUCT_IMAGE_SIZES[usage]} />
          <source type="image/webp" srcSet={resolved.webpSrcSet} sizes={PRODUCT_IMAGE_SIZES[usage]} />
          <img
            ref={imgRef}
            src={resolved.fallbackSrc}
            alt={alt}
            width={640}
            height={640}
            loading={loading}
            decoding={priority ? "auto" : "async"}
            fetchPriority={fetchPriority}
            onError={onError}
            className="h-full w-full object-cover"
          />
        </picture>
      )}

      {!failed && resolved.kind === "url" && (
        <img
          ref={imgRef}
          src={resolved.src}
          alt={alt}
          width={640}
          height={640}
          loading={loading}
          decoding="async"
          onError={onError}
          className="h-full w-full object-cover"
        />
      )}

      {failed && (
        <div
          role="img"
          aria-label={alt}
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-gradient-to-br",
            CATEGORY_GRADIENT[category],
          )}
        >
          <Icon style={{ width: iconSize, height: iconSize }} aria-hidden />
        </div>
      )}
    </div>
  );
}
