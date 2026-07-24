"use client";

/*
 * A plain <img> is used deliberately (instead of next/image) so the module
 * needs no remote-host configuration and stays portable across the Cloudflare
 * deployment target.
 */
/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import type { ProductCategory } from "@/lib/data/products";
import { CATEGORY_GRADIENT, CATEGORY_ICON } from "@/components/products/category-visuals";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src: string;
  alt: string;
  category: ProductCategory;
  className?: string;
  /** Size of the fallback icon, in px. */
  iconSize?: number;
}

/**
 * Product thumbnail with a skeleton while loading and a category-tinted
 * gradient + icon fallback if the placeholder image fails to load. Uses a
 * plain <img> so no next/image remote-host configuration is required.
 */
export function ProductImage({
  src,
  alt,
  category,
  className,
  iconSize = 28,
}: ProductImageProps) {
  const [loaded, setLoaded] = React.useState(false);
  const [errored, setErrored] = React.useState(false);
  const Icon = CATEGORY_ICON[category];

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        className,
      )}
    >
      {!errored && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {(errored || !loaded) && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-gradient-to-br",
            errored ? CATEGORY_GRADIENT[category] : "from-muted to-muted",
          )}
        >
          {errored && (
            <Icon style={{ width: iconSize, height: iconSize }} aria-hidden />
          )}
        </div>
      )}
    </div>
  );
}
