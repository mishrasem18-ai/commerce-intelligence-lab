"use client";

import { useCart } from "@/lib/store/cart-store";
import { useProducts } from "@/lib/store/products-store";
import { computeOrderTotals, type OrderTotals } from "@/lib/commerce";
import type { Product } from "@/lib/data/products";

export interface CartDetailLine {
  product: Product;
  quantity: number;
  lineTotal: number;
  /** Requested quantity exceeds available inventory. */
  overStock: boolean;
}

export interface CartDetails {
  lines: CartDetailLine[];
  subtotal: number;
  totals: OrderTotals;
  hasStockIssue: boolean;
}

/** Joins persisted cart lines with live product data and recomputes totals. */
export function useCartDetails(): CartDetails {
  const { items } = useCart();
  const { getProduct } = useProducts();

  const lines: CartDetailLine[] = [];
  for (const item of items) {
    const product = getProduct(item.productId);
    if (!product) continue;
    lines.push({
      product,
      quantity: item.quantity,
      lineTotal: Math.round(product.price * item.quantity * 100) / 100,
      overStock: item.quantity > product.inventory,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  return {
    lines,
    subtotal,
    totals: computeOrderTotals(subtotal),
    hasStockIssue: lines.some((line) => line.overStock),
  };
}
