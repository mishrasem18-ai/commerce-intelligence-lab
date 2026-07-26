/**
 * Domain-mapper tests: canonical items from the real product model, order →
 * purchase context without PII, and purchase deduplication over the real
 * order lifecycle shape.
 * Run: npm run test:analytics
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { products } from "../data/products.ts";
import type { Order } from "../data.ts";
import {
  cartCommerce,
  createOnceTracker,
  listCommerce,
  orderCommerce,
  productCommerce,
  productToItem,
} from "./tracking.ts";
import { createAnalytics } from "./analytics.ts";
import { createConsentStore } from "./consent.ts";

test("productToItem maps the real Product model onto the canonical item", () => {
  const product = products[0];
  const item = productToItem(product, { listName: "Electronics", listPosition: 3 });
  assert.equal(item.product_id, product.id);
  assert.equal(item.sku, product.sku);
  assert.equal(item.name, product.name);
  assert.equal(item.brand, product.brand);
  assert.equal(item.category, product.category);
  assert.equal(item.category_id, product.categoryId);
  assert.equal(item.price, product.price);
  assert.equal(item.quantity, 1);
  assert.equal(item.currency, "USD");
  assert.equal(item.list_name, "Electronics");
  assert.equal(item.list_position, 3);
  // Nothing but the canonical fields — no description/image/cost/revenue leak.
  assert.deepEqual(
    Object.keys(item).sort(),
    [
      "brand",
      "category",
      "category_id",
      "currency",
      "list_name",
      "list_position",
      "name",
      "price",
      "product_id",
      "quantity",
      "sku",
    ],
  );
});

test("productCommerce values a multi-quantity add correctly", () => {
  const product = products[0];
  const commerce = productCommerce(product, { quantity: 3 });
  assert.equal(commerce.value, Math.round(product.price * 3 * 100) / 100);
  assert.equal(commerce.items?.[0].quantity, 3);
});

test("listCommerce positions items 1-based within the named list", () => {
  const list = products.slice(0, 4);
  const commerce = listCommerce(list, "Gaming");
  assert.equal(commerce.list_name, "Gaming");
  assert.equal(commerce.item_count, 4);
  assert.deepEqual(
    commerce.items?.map((item) => item.list_position),
    [1, 2, 3, 4],
  );
});

test("cartCommerce totals quantities across lines", () => {
  const lines = [
    { product: products[0], quantity: 2, lineTotal: 0, overStock: false },
    { product: products[1], quantity: 1, lineTotal: 0, overStock: false },
  ];
  const commerce = cartCommerce(lines, 199.99);
  assert.equal(commerce.value, 199.99);
  assert.equal(commerce.item_count, 3);
  assert.equal(commerce.items?.length, 2);
});

/** A realistic buyer-created order INCLUDING the PII the API returns. */
const ORDER: Order = {
  id: "ord-7f3a",
  customer: "Repro Tester",
  email: "repro@example.test",
  country: "India",
  countryCode: "IN",
  amount: 172.78,
  status: "Processing",
  date: "2026-07-26",
  items: 2,
  orderNumber: "AM-1042",
  customerId: "C-AB12CD",
  lineItems: [
    { productId: "prod-1001", name: "Halo Desk Lamp", sku: "HLO-DL-1001", price: 49.99, quantity: 2 },
    { productId: "prod-1002", name: "Vortex Gaming Mouse", sku: "VTX-GM-1002", price: 59.99, quantity: 1 },
  ],
  subtotal: 159.97,
  tax: 12.8,
  shipping: 0,
  total: 172.78,
  shippingAddress: {
    id: "addr-1",
    fullName: "Repro Tester",
    mobile: "+91 98765 43210",
    line1: "42 Test Lane",
    city: "Mumbai",
    state: "MH",
    postalCode: "400001",
    country: "India",
  },
  paymentMethod: "Card",
  paymentStatus: "Paid",
};

test("orderCommerce maps commercial fields and excludes every PII field", () => {
  const commerce = orderCommerce(ORDER);
  assert.equal(commerce.order_id, "AM-1042");
  assert.equal(commerce.value, 172.78);
  assert.equal(commerce.tax, 12.8);
  assert.equal(commerce.shipping, 0);
  assert.equal(commerce.payment_method, "Card");
  assert.equal(commerce.item_count, 3);
  assert.equal(commerce.items?.length, 2);

  const serialized = JSON.stringify(commerce);
  assert.ok(!serialized.includes("repro@example.test"), "email must not leak");
  assert.ok(!serialized.includes("Repro Tester"), "customer name must not leak");
  assert.ok(!serialized.includes("98765"), "phone must not leak");
  assert.ok(!serialized.includes("Test Lane"), "address must not leak");
  assert.ok(!serialized.includes("400001"), "postal code must not leak");
});

test("purchase fires exactly once for a completed order lifecycle", () => {
  let id = 0;
  const service = createAnalytics({
    consentStore: createConsentStore(null),
    environment: "test",
    getPageContext: () => ({
      path: "/checkout",
      title: "Checkout",
      page_type: "checkout",
      query_string: "",
    }),
    now: () => "2026-07-26T10:00:00.000Z",
    createId: () => `evt-${++id}`,
  });

  // Mirrors the checkout success handler: track only on the successful
  // order-creation response, guarded by the once-tracker.
  const purchaseTracked = createOnceTracker();
  const onOrderCreated = (order: Order) => {
    if (purchaseTracked.first(order.id)) {
      service.track("commerce.purchase", { commerce: orderCommerce(order) });
    }
  };

  onOrderCreated(ORDER); // success response
  onOrderCreated(ORDER); // duplicated callback / re-render — must be ignored

  const purchases = service.dispatcher
    .getLog()
    .filter((record) => record.event.event_name === "commerce.purchase");
  assert.equal(purchases.length, 1);
  assert.equal(purchases[0].event.commerce?.order_id, "AM-1042");

  // A different order is a fresh purchase.
  onOrderCreated({ ...ORDER, id: "ord-9c1b", orderNumber: "AM-1043" });
  assert.equal(
    service.dispatcher
      .getLog()
      .filter((record) => record.event.event_name === "commerce.purchase").length,
    2,
  );
});

test("failed order creation emits no purchase (trigger is the success branch only)", () => {
  const service = createAnalytics({
    consentStore: createConsentStore(null),
    environment: "test",
    getPageContext: () => ({
      path: "/checkout",
      title: "Checkout",
      page_type: "checkout",
      query_string: "",
    }),
  });
  const purchaseTracked = createOnceTracker();
  const onOrderResponse = (ok: boolean, order: Order | null) => {
    if (ok && order && purchaseTracked.first(order.id)) {
      service.track("commerce.purchase", { commerce: orderCommerce(order) });
    }
  };
  onOrderResponse(false, null);
  onOrderResponse(false, ORDER);
  assert.equal(
    service.dispatcher
      .getLog()
      .filter((record) => record.event.event_name === "commerce.purchase").length,
    0,
  );
});
