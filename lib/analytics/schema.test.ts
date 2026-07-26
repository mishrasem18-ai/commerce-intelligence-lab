/**
 * Schema tests: page-type derivation and the (unused-until-Phase-2) GTM
 * mapping that proves vendor naming stays inside the adapter.
 * Run: npm run test:analytics
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { ANALYTICS_EVENT_NAMES, pageTypeFromPath } from "./schema.ts";
import { GA4_EVENT_NAME_MAP, mapEventToDataLayer } from "./adapters/gtm-adapter.ts";
import type { AnalyticsData } from "./schema.ts";

test("pageTypeFromPath covers every storefront journey", () => {
  assert.equal(pageTypeFromPath("/"), "home");
  assert.equal(pageTypeFromPath("/shop"), "product_list");
  assert.equal(pageTypeFromPath("/product/prod-1001"), "product_detail");
  assert.equal(pageTypeFromPath("/cart"), "cart");
  assert.equal(pageTypeFromPath("/checkout"), "checkout");
  assert.equal(pageTypeFromPath("/order-confirmation/AM-1042"), "order_confirmation");
  assert.equal(pageTypeFromPath("/login"), "auth_login");
  assert.equal(pageTypeFromPath("/signup"), "auth_signup");
  assert.equal(pageTypeFromPath("/account/orders"), "account");
  assert.equal(pageTypeFromPath("/admin/dashboard"), "other");
});

test("canonical event names follow the namespace.verb convention", () => {
  for (const name of ANALYTICS_EVENT_NAMES) {
    assert.match(name, /^(page|commerce|user|search|consent)\.[a-z_]+$/);
  }
});

test("GTM mapping translates canonical names to GA4 names inside the adapter", () => {
  assert.equal(GA4_EVENT_NAME_MAP["commerce.add_to_cart"], "add_to_cart");
  assert.equal(GA4_EVENT_NAME_MAP["commerce.purchase"], "purchase");

  const event: AnalyticsData = {
    event_name: "commerce.add_to_cart",
    event_id: "evt-1",
    timestamp: "2026-07-26T10:00:00.000Z",
    schema_version: "1.0",
    page: { path: "/shop", title: "Shop", page_type: "product_list", query_string: "" },
    user: { authentication_state: "guest" },
    consent: { necessary: true, analytics: true, advertising: false, personalization: false },
    app: { name: "aurora-market", environment: "test" },
    commerce: {
      currency: "USD",
      value: 49.99,
      items: [
        {
          product_id: "prod-1001",
          sku: "HLO-DL-1001",
          name: "Halo Desk Lamp",
          brand: "Halo",
          category: "Home",
          category_id: "home",
          price: 49.99,
          quantity: 1,
          currency: "USD",
        },
      ],
    },
  };
  const pushed = mapEventToDataLayer(event) as {
    event: string;
    ecommerce: { items: Array<{ item_id: string; item_name: string }> };
  };
  assert.equal(pushed.event, "add_to_cart");
  assert.equal(pushed.ecommerce.items[0].item_id, "prod-1001");
  assert.equal(pushed.ecommerce.items[0].item_name, "Halo Desk Lamp");
});
