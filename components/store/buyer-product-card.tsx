"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/products/product-image";
import { useCart } from "@/lib/store/cart-store";
import { useToast } from "@/components/ui/toast";
import type { Product } from "@/lib/data/products";
import { formatCurrency } from "@/lib/utils";

export function BuyerProductCard({ product }: { product: Product }) {
  const { items, addItem } = useCart();
  const { toast } = useToast();

  const inCart = items.find((line) => line.productId === product.id)?.quantity ?? 0;
  const outOfStock = product.inventory <= 0;
  const maxedOut = inCart >= product.inventory;

  const handleAdd = () => {
    if (outOfStock) return;
    if (maxedOut) {
      toast({
        variant: "info",
        title: "Stock limit reached",
        description: `Only ${product.inventory} in stock.`,
      });
      return;
    }
    addItem(product.id, 1);
    toast({ variant: "success", title: "Added to cart", description: product.name });
  };

  return (
    <Card className="group flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5">
      <Link href={`/product/${product.id}`} className="relative block">
        <ProductImage
          src={product.image}
          alt={product.name}
          category={product.category}
          className="aspect-square w-full transition-transform duration-300 group-hover:scale-[1.03]"
          iconSize={40}
        />
        {outOfStock && (
          <span className="absolute left-3 top-3 rounded-full bg-foreground/80 px-2.5 py-0.5 text-xs font-medium text-background">
            Out of Stock
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-muted-foreground">
            {product.brand}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums text-foreground">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            {product.rating.toFixed(1)}
          </span>
        </div>

        <Link
          href={`/product/${product.id}`}
          className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors hover:text-primary"
        >
          {product.name}
        </Link>

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-lg font-semibold tracking-tight tabular-nums text-foreground">
            {formatCurrency(product.price, { maximumFractionDigits: 2 })}
          </span>
          {!outOfStock && product.inventory <= 25 && (
            <span className="text-xs font-medium text-warning-foreground">
              Only {product.inventory} left
            </span>
          )}
        </div>

        <Button
          onClick={handleAdd}
          disabled={outOfStock}
          size="sm"
          variant={outOfStock ? "outline" : "primary"}
          className="mt-2 w-full"
        >
          {outOfStock ? "Out of Stock" : "Add to Cart"}
        </Button>
      </div>
    </Card>
  );
}

export const BUYER_GRID_CLASS =
  "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4";
