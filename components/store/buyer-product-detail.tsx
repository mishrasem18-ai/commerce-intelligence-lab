"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Truck,
  Zap,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductGallery } from "@/components/products/product-gallery";
import { BuyerProductCard } from "@/components/store/buyer-product-card";
import { CATEGORY_ICON } from "@/components/products/category-visuals";
import { useCart } from "@/lib/store/cart-store";
import { useProducts } from "@/lib/store/products-store";
import { useToast } from "@/components/ui/toast";
import { buyerProducts, isPurchasable } from "@/lib/commerce";
import type { Product } from "@/lib/data/products";
import { formatCurrency } from "@/lib/utils";

export function BuyerProductDetail({
  id,
  initialProduct,
}: {
  id: string;
  initialProduct: Product | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { products, getProduct, hydrated } = useProducts();
  const { items, addItem } = useCart();
  const [qty, setQty] = React.useState(1);

  const product = getProduct(id) ?? initialProduct ?? null;

  if (!product || (hydrated && !isPurchasable(product))) {
    if (!product && !hydrated) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      );
    }
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-7xl flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold text-foreground">
          Product not available
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This product doesn&apos;t exist or is no longer available for purchase.
        </p>
        <Link href="/shop" className={buttonVariants({ variant: "outline" })}>
          Continue shopping
        </Link>
      </div>
    );
  }

  const CategoryIcon = CATEGORY_ICON[product.category];
  const inCart = items.find((line) => line.productId === product.id)?.quantity ?? 0;
  const outOfStock = product.inventory <= 0;
  const maxAddable = Math.max(0, product.inventory - inCart);
  const effectiveQty = Math.min(qty, Math.max(1, maxAddable));

  const related = buyerProducts(products)
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const addToCart = () => {
    if (outOfStock) return;
    if (maxAddable <= 0) {
      toast({
        variant: "info",
        title: "Stock limit reached",
        description: `You already have the maximum available in your cart.`,
      });
      return;
    }
    addItem(product.id, Math.min(effectiveQty, maxAddable));
    toast({
      variant: "success",
      title: "Added to cart",
      description: `${effectiveQty} × ${product.name}`,
    });
  };

  const buyNow = () => {
    if (outOfStock) return;
    if (maxAddable > 0) addItem(product.id, Math.min(effectiveQty, maxAddable));
    router.push("/checkout");
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-4" />
        <Link href="/shop" className="hover:text-foreground">
          Shop
        </Link>
        <ChevronRight className="size-4" />
        <span className="truncate font-medium text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <ProductGallery product={product} />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <Link
              href={`/shop?q=${encodeURIComponent(product.brand)}`}
              className="text-sm font-medium text-muted-foreground hover:text-primary"
            >
              {product.brand}
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {product.name}
            </h1>
            <div className="mt-2 flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-sm font-medium tabular-nums text-foreground">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                {product.rating.toFixed(1)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <CategoryIcon className="size-4" />
                {product.category}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
              {formatCurrency(product.price, { maximumFractionDigits: 2 })}
            </span>
            {outOfStock ? (
              <Badge variant="danger">Out of Stock</Badge>
            ) : product.inventory <= 25 ? (
              <Badge variant="warning">Only {product.inventory} left</Badge>
            ) : (
              <Badge variant="success">In Stock</Badge>
            )}
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>

          {!outOfStock && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-lg border border-input">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex size-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  disabled={effectiveQty <= 1}
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-10 text-center text-sm font-medium tabular-nums">
                  {effectiveQty}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQty((q) => Math.min(maxAddable || 1, q + 1))}
                  className="flex size-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  disabled={effectiveQty >= maxAddable}
                >
                  <Plus className="size-4" />
                </button>
              </div>
              {inCart > 0 && (
                <span className="text-xs text-muted-foreground">
                  {inCart} already in cart
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={addToCart}
              disabled={outOfStock || maxAddable <= 0}
              size="lg"
              variant="outline"
              className="flex-1"
            >
              <ShoppingCart />
              Add to Cart
            </Button>
            <Button onClick={buyNow} disabled={outOfStock} size="lg" className="flex-1">
              <Zap />
              Buy Now
            </Button>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Truck className="size-4 shrink-0" />
            Free shipping on orders over {formatCurrency(150)}. Easy 30-day returns.
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-xl font-semibold tracking-tight text-foreground">
            You may also like
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <BuyerProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
