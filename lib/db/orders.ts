import "server-only";
import { getDb } from "@/lib/db/client";
import type { Order, OrderLineItem, Address, PaymentMethod, PaymentStatus } from "@/lib/data";

export interface CreateOrderInput {
  userId: string;
  customerName: string;
  email: string;
  country: string;
  countryCode: string;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shipping: {
    fullName: string;
    mobile: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: {
    productId: string;
    name: string;
    sku: string;
    unitPriceCents: number;
    quantity: number;
  }[];
}

function generateOrderNumber(): string {
  const rand = crypto.getRandomValues(new Uint8Array(5));
  const suffix = [...rand].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 7).toUpperCase();
  return `ORD-${suffix}`;
}

/**
 * Create an order atomically: insert the order + line items, decrement product
 * inventory (the products.inventory CHECK(>=0) constraint rolls the whole batch
 * back on oversell), and update the buyer's order metrics. D1 batches run as a
 * single implicit transaction — all-or-nothing.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<{ id: string; orderNumber: string; placedAt: string }> {
  const db = await getDb();
  const orderNumber = generateOrderNumber();
  const id = `#${orderNumber}`;
  const placedAt = new Date().toISOString();

  const statements = [
    db
      .prepare(
        "INSERT INTO orders (id, order_number, user_id, customer_name, email, country, country_code, " +
          "status, payment_method, payment_status, subtotal_cents, tax_cents, shipping_cents, total_cents, " +
          "ship_full_name, ship_mobile, ship_line1, ship_line2, ship_city, ship_state, ship_postal_code, " +
          "ship_country, placed_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'Processing', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id, orderNumber, input.userId, input.customerName, input.email, input.country, input.countryCode,
        input.paymentMethod, input.paymentStatus, input.subtotalCents, input.taxCents, input.shippingCents,
        input.totalCents, input.shipping.fullName, input.shipping.mobile, input.shipping.line1,
        input.shipping.line2, input.shipping.city, input.shipping.state, input.shipping.postalCode,
        input.shipping.country, placedAt,
      ),
    ...input.items.map((it, i) =>
      db
        .prepare(
          "INSERT INTO order_items (id, order_id, product_id, product_name, sku, unit_price_cents, quantity, line_total_cents) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `${id}-${i}`, id, it.productId, it.name, it.sku, it.unitPriceCents, it.quantity,
          it.unitPriceCents * it.quantity,
        ),
    ),
    // Oversell rolls the batch back via CHECK(inventory >= 0).
    ...input.items.map((it) =>
      db
        .prepare(
          "UPDATE products SET inventory = inventory - ?1, units_sold = units_sold + ?1, " +
            "revenue_cents = revenue_cents + ?2, updated_at = datetime('now') WHERE id = ?3",
        )
        .bind(it.quantity, it.unitPriceCents * it.quantity, it.productId),
    ),
    db
      .prepare(
        "UPDATE users SET orders_count = orders_count + 1, spent_cents = spent_cents + ?, " +
          "last_order_at = ?, status = CASE WHEN status = 'New' THEN 'Active' ELSE status END, " +
          "updated_at = datetime('now') WHERE id = ?",
      )
      .bind(input.totalCents, placedAt.slice(0, 10), input.userId),
  ];

  await db.batch(statements);
  return { id, orderNumber, placedAt };
}

interface OrderRow {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string;
  email: string;
  country: string | null;
  country_code: string | null;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  total_cents: number;
  ship_full_name: string | null;
  ship_mobile: string | null;
  ship_line1: string | null;
  ship_line2: string | null;
  ship_city: string | null;
  ship_state: string | null;
  ship_postal_code: string | null;
  ship_country: string | null;
  placed_at: string;
  created_at: string;
}
interface ItemRow {
  order_id: string;
  product_id: string | null;
  product_name: string;
  sku: string;
  unit_price_cents: number;
  quantity: number;
}

function toAddress(row: OrderRow): Address | undefined {
  if (!row.ship_line1) return undefined;
  return {
    id: `addr-${row.id}`,
    fullName: row.ship_full_name ?? row.customer_name,
    mobile: row.ship_mobile ?? "",
    line1: row.ship_line1,
    line2: row.ship_line2 ?? undefined,
    city: row.ship_city ?? "",
    state: row.ship_state ?? "",
    postalCode: row.ship_postal_code ?? "",
    country: row.ship_country ?? row.country ?? "",
  };
}

function toOrder(row: OrderRow, items: OrderLineItem[]): Order {
  return {
    id: row.id,
    customer: row.customer_name,
    email: row.email,
    country: row.country ?? "",
    countryCode: row.country_code ?? "",
    amount: row.total_cents / 100,
    status: row.status as Order["status"],
    date: row.placed_at.slice(0, 10),
    items: items.length,
    orderNumber: row.order_number,
    customerId: row.user_id ?? undefined,
    lineItems: items.length > 0 ? items : undefined,
    subtotal: row.subtotal_cents / 100,
    tax: row.tax_cents / 100,
    shipping: row.shipping_cents / 100,
    total: row.total_cents / 100,
    shippingAddress: toAddress(row),
    paymentMethod: row.payment_method as PaymentMethod,
    paymentStatus: row.payment_status as PaymentStatus,
    createdAt: row.created_at,
  };
}

function toLineItem(row: ItemRow): OrderLineItem {
  return {
    productId: row.product_id ?? "",
    name: row.product_name,
    sku: row.sku,
    price: row.unit_price_cents / 100,
    quantity: row.quantity,
  };
}

/** All orders (with their line items), most recent first. */
export async function getOrders(): Promise<Order[]> {
  const db = await getDb();
  const [{ results: orderRows }, { results: itemRows }] = await Promise.all([
    db.prepare("SELECT * FROM orders ORDER BY placed_at DESC, id DESC").all<OrderRow>(),
    db.prepare("SELECT * FROM order_items").all<ItemRow>(),
  ]);
  const itemsByOrder = new Map<string, OrderLineItem[]>();
  for (const r of itemRows) {
    itemsByOrder.set(r.order_id, [...(itemsByOrder.get(r.order_id) ?? []), toLineItem(r)]);
  }
  return orderRows.map((row) => toOrder(row, itemsByOrder.get(row.id) ?? []));
}

/** A single order (with line items) by id, or null. */
export async function getOrderById(id: string): Promise<Order | null> {
  const db = await getDb();
  const row = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
  if (!row) return null;
  const { results: itemRows } = await db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .bind(id)
    .all<ItemRow>();
  return toOrder(row, itemRows.map(toLineItem));
}

/** A single order by its order_number (the admin URL slug, e.g. "ORD-7841"). */
export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT * FROM orders WHERE order_number = ?")
    .bind(orderNumber)
    .first<OrderRow>();
  if (!row) return null;
  const { results: itemRows } = await db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .bind(row.id)
    .all<ItemRow>();
  return toOrder(row, itemRows.map(toLineItem));
}
