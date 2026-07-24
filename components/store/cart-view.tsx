"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProductImage } from "@/components/products/product-image";
import { OrderSummary } from "@/components/store/order-summary";
import { useCart } from "@/lib/store/cart-store";
import { useCartDetails } from "@/lib/hooks/use-cart-details";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function CartView() {
  const router = useRouter();
  const { setQuantity, removeItem, clear } = useCart();
  const { lines, totals, hasStockIssue } = useCartDetails();

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ShoppingBag className="size-8" />
        </span>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Your cart is empty
          </h1>
          <p className="text-sm text-muted-foreground">
            Browse the shop and add products to get started.
          </p>
        </div>
        <Link href="/shop" className={buttonVariants()}>
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Shopping Cart
        </h1>
        <button
          type="button"
          onClick={clear}
          className="text-sm text-muted-foreground transition-colors hover:text-danger"
        >
          Clear cart
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          {lines.map(({ product, quantity, lineTotal, overStock }) => (
            <Card key={product.id}>
              <CardContent className="flex gap-4 p-4">
                <Link href={`/product/${product.id}`} className="shrink-0">
                  <ProductImage
                    src={product.image}
                    alt={product.name}
                    category={product.category}
                    className="size-20 rounded-xl sm:size-24"
                    iconSize={28}
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/product/${product.id}`}
                        className="line-clamp-2 text-sm font-semibold text-foreground hover:text-primary"
                      >
                        {product.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{product.brand}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${product.name}`}
                      onClick={() => removeItem(product.id)}
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  {product.inventory <= 0 ? (
                    <p className="text-xs font-medium text-danger">Out of stock</p>
                  ) : overStock ? (
                    <p className="text-xs font-medium text-warning-foreground">
                      Only {product.inventory} available
                    </p>
                  ) : null}

                  <div className="mt-auto flex items-center justify-between gap-3">
                    <div className="flex items-center rounded-lg border border-input">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => setQuantity(product.id, quantity - 1)}
                        className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-9 text-center text-sm font-medium tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() =>
                          setQuantity(
                            product.id,
                            Math.min(product.inventory, quantity + 1),
                          )
                        }
                        disabled={quantity >= product.inventory}
                        className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(lineTotal, { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(product.price, { maximumFractionDigits: 2 })} each
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-24">
            <CardContent className="flex flex-col gap-4 p-5">
              <h2 className="text-base font-semibold text-foreground">Order Summary</h2>
              <OrderSummary totals={totals} />
              <Button
                onClick={() => router.push("/checkout")}
                disabled={hasStockIssue}
                size="lg"
                className="w-full"
              >
                Proceed to Checkout
              </Button>
              {hasStockIssue && (
                <p className="text-center text-xs text-danger">
                  Adjust quantities that exceed available stock to continue.
                </p>
              )}
              <Link
                href="/shop"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "w-full",
                )}
              >
                Continue shopping
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
