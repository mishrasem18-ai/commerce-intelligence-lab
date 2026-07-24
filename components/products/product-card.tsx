"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/products/status-badge";
import { InventoryBadge } from "@/components/products/inventory-badge";
import { ProductImage } from "@/components/products/product-image";
import {
  ProductActionsMenu,
  type ProductAction,
} from "@/components/products/product-actions-menu";
import { CATEGORY_ICON } from "@/components/products/category-visuals";
import type { Product } from "@/lib/data/products";
import { cn, formatCompact, formatCurrency, formatNumber } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  onAction: (action: ProductAction, product: Product) => void;
}

export function ProductCard({ product, onAction }: ProductCardProps) {
  const CategoryIcon = CATEGORY_ICON[product.category];

  return (
    <Card className="group flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-lg hover:shadow-black/5">
      <div className="relative">
        <Link
          href={`/admin/products/${product.id}`}
          aria-label={`View ${product.name}`}
          className="block focus-visible:outline-none"
        >
          <ProductImage
            src={product.image}
            alt={product.name}
            category={product.category}
            className="aspect-[4/3] w-full transition-transform duration-300 group-hover:scale-[1.03]"
            iconSize={40}
          />
        </Link>
        <div className="absolute left-3 top-3">
          <StatusBadge status={product.status} className="shadow-sm" />
        </div>
        <div className="absolute right-2 top-2">
          <ProductActionsMenu
            product={product}
            onAction={onAction}
            triggerClassName="bg-card/80 backdrop-blur-sm hover:bg-card"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CategoryIcon className="size-3.5" />
            {product.category}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums text-foreground">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            {product.rating.toFixed(1)}
          </span>
        </div>

        <div className="min-w-0">
          <Link
            href={`/admin/products/${product.id}`}
            className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors hover:text-primary"
          >
            {product.name}
          </Link>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            <span className="font-mono">{product.sku}</span> · {product.brand}
          </p>
        </div>

        <div className="mt-auto space-y-3 border-t border-border/70 pt-3">
          <div className="flex items-end justify-between gap-2">
            <span className="text-lg font-semibold tracking-tight tabular-nums text-foreground">
              {formatCurrency(product.price, { maximumFractionDigits: 2 })}
            </span>
            <InventoryBadge inventory={product.inventory} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-muted/60 px-2.5 py-1.5">
              <p className="text-muted-foreground">Revenue</p>
              <p className="font-semibold tabular-nums text-foreground">
                ${formatCompact(product.revenue)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/60 px-2.5 py-1.5">
              <p className="text-muted-foreground">Units sold</p>
              <p className="font-semibold tabular-nums text-foreground">
                {formatNumber(product.unitsSold)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Class hook kept beside the card so the grid and skeleton stay in sync. */
export const PRODUCT_GRID_CLASS = cn(
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
);
