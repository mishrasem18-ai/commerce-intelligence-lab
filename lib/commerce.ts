import type { Product } from "@/lib/data/products";

/** Deterministic demo tax + shipping model. Replace with real rules later. */
export const TAX_RATE = 0.08;
export const FREE_SHIPPING_THRESHOLD = 150;
export const SHIPPING_FEE = 9.99;

export interface OrderTotals {
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeOrderTotals(subtotal: number): OrderTotals {
  const tax = round(subtotal * TAX_RATE);
  const shipping =
    subtotal <= 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = round(subtotal + tax + shipping);
  return { subtotal: round(subtotal), tax, shipping, total };
}

/** A product is offered to buyers only when it is Active. */
export function isPurchasable(product: Product): boolean {
  return product.status === "Active";
}

export function buyerProducts(products: Product[]): Product[] {
  return products.filter(isPurchasable);
}
