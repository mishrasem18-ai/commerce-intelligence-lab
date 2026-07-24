import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { StatusBadge } from "@/components/products/status-badge";
import { ProductDetailActions } from "@/components/products/product-detail-actions";
import { CATEGORY_ICON } from "@/components/products/category-visuals";
import type { Product } from "@/lib/data/products";

export function ProductHeader({
  product,
  onEdit,
}: {
  product: Product;
  onEdit: () => void;
}) {
  const CategoryIcon = CATEGORY_ICON[product.category];

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/products" className="transition-colors hover:text-foreground">
          Products
        </Link>
        <ChevronRight className="size-4" />
        <span className="truncate font-medium text-foreground">{product.name}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {product.name}
            </h1>
            <StatusBadge status={product.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono">{product.sku}</span>
            <span className="text-border">•</span>
            <span>{product.brand}</span>
            <span className="text-border">•</span>
            <span className="inline-flex items-center gap-1.5">
              <CategoryIcon className="size-4" />
              {product.category}
            </span>
            <span className="text-border">•</span>
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Star className="size-4 fill-amber-400 text-amber-400" />
              {product.rating.toFixed(1)}
            </span>
          </div>
        </div>

        <ProductDetailActions product={product} onEdit={onEdit} />
      </div>
    </div>
  );
}
