/**
 * Mappers from Aurora Market's real domain models (Product, cart lines,
 * Order) to canonical analytics contexts, plus purchase deduplication.
 * Pure functions — unit-tested in Node without a browser.
 */

import type { Product } from "@/lib/data/products";
import type { Order } from "@/lib/data";
import type { CartDetailLine } from "@/lib/hooks/use-cart-details";
import {
  ANALYTICS_CURRENCY,
  type CommerceContext,
  type CommerceItem,
} from "@/lib/analytics/schema";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface ItemOptions {
  quantity?: number;
  listName?: string;
  listPosition?: number;
}

/** Canonical commerce item from the real Product model. Never includes PII. */
export function productToItem(product: Product, options: ItemOptions = {}): CommerceItem {
  return {
    product_id: product.id,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    category: product.category,
    category_id: product.categoryId,
    price: product.price,
    quantity: options.quantity ?? 1,
    currency: ANALYTICS_CURRENCY,
    ...(options.listName ? { list_name: options.listName } : {}),
    ...(options.listPosition !== undefined ? { list_position: options.listPosition } : {}),
  };
}

/** Commerce context for a single-product event (view/select/add/remove). */
export function productCommerce(
  product: Product,
  options: ItemOptions = {},
): CommerceContext {
  const item = productToItem(product, options);
  return {
    currency: ANALYTICS_CURRENCY,
    value: roundMoney(item.price * item.quantity),
    items: [item],
    ...(options.listName ? { list_name: options.listName } : {}),
  };
}

/** Commerce context for a product-list view. */
export function listCommerce(
  products: Product[],
  listName: string,
): CommerceContext {
  return {
    currency: ANALYTICS_CURRENCY,
    list_name: listName,
    item_count: products.length,
    items: products.map((product, index) =>
      productToItem(product, { listName, listPosition: index + 1 }),
    ),
  };
}

/** Commerce context for cart-level events (view_cart, begin_checkout…). */
export function cartCommerce(
  lines: CartDetailLine[],
  totalValue: number,
): CommerceContext {
  return {
    currency: ANALYTICS_CURRENCY,
    value: roundMoney(totalValue),
    item_count: lines.reduce((sum, line) => sum + line.quantity, 0),
    items: lines.map((line) => productToItem(line.product, { quantity: line.quantity })),
  };
}

/**
 * Commerce context from a COMPLETED order (the D1-created order returned by
 * POST /api/orders). Deliberately maps only non-PII commercial fields — the
 * order's email, customer name and shipping address never enter the payload.
 */
export function orderCommerce(order: Order): CommerceContext {
  return {
    currency: ANALYTICS_CURRENCY,
    order_id: order.orderNumber ?? order.id,
    value: roundMoney(order.total ?? order.amount),
    tax: order.tax,
    shipping: order.shipping,
    payment_method: order.paymentMethod,
    item_count: (order.lineItems ?? []).reduce((sum, li) => sum + li.quantity, 0),
    items: (order.lineItems ?? []).map((li) => ({
      product_id: li.productId,
      sku: li.sku,
      name: li.name,
      brand: "",
      category: "",
      category_id: "",
      price: li.price,
      quantity: li.quantity,
      currency: ANALYTICS_CURRENCY,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/*  Purchase deduplication                                                    */
/* -------------------------------------------------------------------------- */

/**
 * `commerce.purchase` must fire exactly once per completed order. The trigger
 * is the successful `/api/orders` response (never a page load or re-render);
 * this tracker adds a belt-and-braces key guard so even a duplicated success
 * callback cannot double-fire.
 */
export interface OnceTracker {
  /** Returns true the first time a key is seen, false afterwards. */
  first(key: string): boolean;
}

export function createOnceTracker(): OnceTracker {
  const seen = new Set<string>();
  return {
    first(key: string) {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
  };
}
