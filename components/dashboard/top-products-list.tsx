import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/data";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

function stockBadge(stock: number) {
  if (stock === 0)
    return <Badge variant="danger">Out of stock</Badge>;
  if (stock < 50)
    return <Badge variant="warning">Low · {stock}</Badge>;
  return <Badge variant="neutral">{formatNumber(stock)} in stock</Badge>;
}

export function TopProductsList({ products }: { products: Product[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {products.map((product, index) => {
        const up = product.trend >= 0;
        return (
          <li
            key={product.id}
            className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {product.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatNumber(product.unitsSold)} units · {product.category}
              </p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {formatCurrency(product.revenue)}
              </p>
              <p
                className={cn(
                  "flex items-center justify-end gap-0.5 text-xs font-medium tabular-nums",
                  up ? "text-success-foreground" : "text-danger-foreground",
                )}
              >
                {up ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {formatPercent(Math.abs(product.trend))}
              </p>
            </div>
            <div className="shrink-0">{stockBadge(product.stock)}</div>
          </li>
        );
      })}
    </ul>
  );
}
