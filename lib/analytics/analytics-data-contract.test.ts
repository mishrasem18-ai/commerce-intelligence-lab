/**
 * analyticsData contract tests: proves the canonical layer is a fresh,
 * vendor-neutral envelope per event — not a mutated global — and that
 * vendor syntax only appears downstream, inside adapters.
 * Run: npm run test:analytics
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnalytics } from "./analytics.ts";
import { createConsentStore } from "./consent.ts";
import type { AnalyticsData } from "./schema.ts";
import type { AnalyticsAdapter } from "./adapters/types.ts";
import { createGtmAdapter, type GtmWindow } from "./adapters/gtm-adapter.ts";

function makeService(adapter?: AnalyticsAdapter) {
  let id = 0;
  return createAnalytics({
    adapters: adapter ? [adapter] : [],
    consentStore: createConsentStore(null),
    environment: "test",
    getPageContext: () => ({
      path: "/shop",
      title: "Shop · Aurora Market",
      page_type: "product_list",
      query_string: "",
    }),
    now: () => "2026-07-26T10:00:00.000Z",
    createId: () => `evt-${++id}`,
  });
}

const COMMERCE = {
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
};

test("every track() call produces a FRESH analyticsData envelope (no shared object)", () => {
  const service = makeService();
  const first = service.track("commerce.add_to_cart", { commerce: COMMERCE })!;
  const second = service.track("page.view")!;
  assert.notEqual(first.event, second.event, "envelopes must be distinct objects");
  assert.notEqual(first.event.page, second.event.page, "contexts must not be shared references");
  // Mutating an already-dispatched envelope cannot affect later events.
  (first.event.page as { title: string }).title = "TAMPERED";
  const third = service.track("page.view")!;
  assert.equal(third.event.page.title, "Shop · Aurora Market");
});

test("no stale commerce data leaks from one analyticsData event into the next", () => {
  const service = makeService();
  const withCommerce = service.track("commerce.add_to_cart", { commerce: COMMERCE })!;
  assert.ok(withCommerce.event.commerce, "commerce event carries commerce context");

  const pageView = service.track("page.view")!;
  assert.equal(pageView.event.commerce, undefined, "next event must NOT inherit commerce");
  assert.equal(pageView.event.search, undefined);
  assert.equal(pageView.event.consent_change, undefined);
});

test("the input payload is not shared by reference into the envelope (scrub copies)", () => {
  const service = makeService();
  const payload = { commerce: { ...COMMERCE, items: [...COMMERCE.items] } };
  const record = service.track("commerce.add_to_cart", payload)!;
  payload.commerce.items[0].name = "MUTATED AFTER TRACK";
  assert.equal(record.event.commerce?.items?.[0].name, "Halo Desk Lamp");
});

test("canonical analyticsData contains NO vendor syntax", () => {
  const { adapter } = { adapter: createGtmAdapter({ containerId: "GTM-TEST123", win: {} }) };
  const service = makeService(adapter);
  service.updateConsent("accept_all");
  const record = service.track("commerce.add_to_cart", { commerce: COMMERCE })!;
  const serialized = JSON.stringify(record.event);
  for (const vendorToken of [
    "gtag",
    "dataLayer",
    "ecommerce", // GA4's container key — canonical uses `commerce`
    "analytics_storage",
    "ad_storage",
    "ad_user_data",
    "ad_personalization",
    "item_id", // GA4 item naming — canonical uses product_id
    "eVar",
    "XDM",
  ]) {
    assert.ok(
      !serialized.includes(vendorToken),
      `canonical envelope must not contain vendor token "${vendorToken}"`,
    );
  }
  // …and the canonical names it MUST use instead:
  assert.equal(record.event.event_name, "commerce.add_to_cart");
  assert.equal(record.event.commerce?.items?.[0].product_id, "prod-1001");
});

test("canonical envelope keys match the analyticsData contract exactly", () => {
  const service = makeService();
  const record = service.track("commerce.add_to_cart", { commerce: COMMERCE })!;
  assert.deepEqual(
    Object.keys(record.event).sort(),
    ["app", "commerce", "consent", "event_id", "event_name", "page", "schema_version", "timestamp", "user"],
  );
  const pageView = service.track("page.view")!;
  assert.deepEqual(
    Object.keys(pageView.event).sort(),
    ["app", "consent", "event_id", "event_name", "page", "schema_version", "timestamp", "user"],
  );
});

test("delivered dispatch records describe the vendor mapping (debugger teaching seam)", () => {
  const win: GtmWindow = {};
  const adapter = createGtmAdapter({ containerId: "GTM-TEST123", win, injectScript: () => {} });
  const service = makeService(adapter);
  service.updateConsent("accept_all");
  const record = service.track("commerce.add_to_cart", { commerce: COMMERCE })!;
  const gtmResult = record.results.find((r) => r.adapter === "gtm")!;
  assert.equal(gtmResult.status, "delivered");
  assert.equal(gtmResult.detail, 'mapped to "add_to_cart" on window.dataLayer');
});

test("a throwing describe() does not taint a successful delivery", () => {
  const received: AnalyticsData[] = [];
  const adapter: AnalyticsAdapter = {
    name: "flaky-describe",
    label: "Flaky",
    consentCategory: "analytics",
    isConfigured: () => true,
    track: (event) => {
      received.push(event);
    },
    describe: () => {
      throw new Error("describe exploded");
    },
  };
  const service = makeService(adapter);
  service.updateConsent("accept_all");
  const record = service.track("page.view")!;
  const result = record.results.find((r) => r.adapter === "flaky-describe")!;
  assert.equal(result.status, "delivered");
  assert.equal(result.detail, undefined);
  assert.equal(received.length, 2); // consent.update + page.view
});
