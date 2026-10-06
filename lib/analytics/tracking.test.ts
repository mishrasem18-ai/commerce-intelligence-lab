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
import type { CommerceItem } from "./schema.ts";
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
  const commerce = cartCommerce(lines);
  assert.equal(commerce.item_count, 3);
  assert.equal(commerce.items?.length, 2);
});

/** Sum of price × quantity in cents, so the expectation has no float drift. */
function itemSum(items: CommerceItem[] | undefined): number {
  const cents = (items ?? []).reduce(
    (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
    0,
  );
  return cents / 100;
}

test("cart value is the sum of price × quantity: no shipping, no tax", () => {
  const lines = [
    { product: { ...products[0], price: 10.99 }, quantity: 1, lineTotal: 0, overStock: false },
  ];
  // The cart page shows 21.86 for this cart (9.99 shipping, 0.88 tax).
  assert.equal(cartCommerce(lines).value, 10.99);

  const mixed = [
    { product: { ...products[0], price: 19.99 }, quantity: 3, lineTotal: 0, overStock: false },
    { product: { ...products[1], price: 0.1 }, quantity: 3, lineTotal: 0, overStock: false },
  ];
  const commerce = cartCommerce(mixed);
  assert.equal(commerce.value, 60.27);
  assert.equal(commerce.value, itemSum(commerce.items));
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

/** The catalog as the checkout sees it: the order's two products, by id. */
const CATALOG = [
  { ...products[0], id: "prod-1001", brand: "Halo", category: "Home", categoryId: "home" },
  { ...products[1], id: "prod-1002", brand: "Vortex", category: "Gaming", categoryId: "gaming" },
];
const getProduct = (id: string) => CATALOG.find((product) => product.id === id);

test("orderCommerce maps commercial fields and excludes every PII field", () => {
  const commerce = orderCommerce(ORDER, getProduct);
  assert.equal(commerce.order_id, "AM-1042");
  assert.equal(commerce.currency, "USD");
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

test("purchase value is the sum of price × quantity; tax and shipping stay separate", () => {
  const commerce = orderCommerce(ORDER, getProduct);
  assert.equal(commerce.value, 159.97); // 2 × 49.99 + 59.99, not the 172.78 total
  assert.equal(commerce.value, itemSum(commerce.items));
  assert.equal(commerce.tax, 12.8);
  assert.equal(commerce.shipping, 0);

  // The order of the live verification: one 10.99 item, total 21.86.
  const small = orderCommerce(
    {
      ...ORDER,
      lineItems: [{ ...ORDER.lineItems![0], price: 10.99, quantity: 1 }],
      subtotal: 10.99,
      tax: 0.88,
      shipping: 9.99,
      total: 21.86,
      amount: 21.86,
    },
    getProduct,
  );
  assert.equal(small.value, 10.99);
  assert.equal(small.tax, 0.88);
  assert.equal(small.shipping, 9.99);
});

test("purchase items carry the catalog's brand and category, like every other commerce event", () => {
  const items = orderCommerce(ORDER, getProduct).items ?? [];
  assert.equal(items.length, 2);
  items.forEach((item, index) => {
    const line = ORDER.lineItems![index];
    // What view_item / add_to_cart send for the same product.
    const viewed = productToItem(getProduct(line.productId)!);
    assert.equal(item.brand, viewed.brand);
    assert.equal(item.category, viewed.category);
    assert.equal(item.category_id, viewed.category_id);
    // Id, price and quantity are the server's order line.
    assert.equal(item.product_id, line.productId);
    assert.equal(item.name, line.name);
    assert.equal(item.sku, line.sku);
    assert.equal(item.price, line.price);
    assert.equal(item.quantity, line.quantity);
  });
});

test("every commerce mapper gives every item a brand and a category", () => {
  const lines = CATALOG.map((product) => ({ product, quantity: 2, lineTotal: 0, overStock: false }));
  const contexts = {
    productCommerce: productCommerce(CATALOG[0], { quantity: 2 }),
    listCommerce: listCommerce(CATALOG, "All Products"),
    cartCommerce: cartCommerce(lines),
    orderCommerce: orderCommerce(ORDER, getProduct),
  };
  for (const [mapper, commerce] of Object.entries(contexts)) {
    assert.ok((commerce.items ?? []).length > 0, mapper);
    for (const item of commerce.items ?? []) {
      assert.ok(item.brand, `${mapper}: brand of ${item.product_id}`);
      assert.ok(item.category, `${mapper}: category of ${item.product_id}`);
      assert.ok(item.category_id, `${mapper}: category_id of ${item.product_id}`);
    }
  }
});

test("an order line whose product left the catalog keeps the order's own fields", () => {
  const commerce = orderCommerce(ORDER, () => undefined);
  assert.deepEqual(
    commerce.items?.map((item) => [item.product_id, item.name, item.price, item.quantity]),
    ORDER.lineItems!.map((line) => [line.productId, line.name, line.price, line.quantity]),
  );
  assert.equal(commerce.value, 159.97);
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
      service.track("commerce.purchase", { commerce: orderCommerce(order, getProduct) });
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
      service.track("commerce.purchase", { commerce: orderCommerce(order, getProduct) });
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
