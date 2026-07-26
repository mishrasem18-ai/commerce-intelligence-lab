/**
 * window.analyticsData inspector tests: read-only, canonical-only, never an
 * alias of the GTM dataLayer, and incapable of mutating internal state.
 * Run: npm run test:analytics
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAnalyticsDataSnapshot, installAnalyticsDataInspector } from "./inspector.ts";
import { createAnalytics } from "./analytics.ts";
import { createConsentStore } from "./consent.ts";
import { createGtmAdapter, type GtmWindow } from "./adapters/gtm-adapter.ts";

function makeService(win: GtmWindow = {}) {
  let id = 0;
  return createAnalytics({
    adapters: [createGtmAdapter({ containerId: "GTM-TEST123", win, injectScript: () => {} })],
    consentStore: createConsentStore(null),
    environment: "test",
    getPageContext: () => ({
      path: "/shop",
      title: "Shop",
      page_type: "product_list",
      query_string: "",
    }),
    now: () => "2026-07-26T10:00:00.000Z",
    createId: () => `evt-${++id}`,
  });
}

const COMMERCE = {
  currency: "USD",
  value: 219.99,
  items: [
    {
      product_id: "prod-1048",
      sku: "VTX-CS-1048",
      name: "Vortex Console Stand Plus",
      brand: "Vortex",
      category: "Gaming",
      category_id: "gaming",
      price: 219.99,
      quantity: 1,
      currency: "USD",
    },
  ],
};

test("snapshot identifies the canonical contract and reflects live state", () => {
  const service = makeService();
  service.updateConsent("accept_all");
  service.track("commerce.add_to_cart", { commerce: COMMERCE });

  const snapshot = buildAnalyticsDataSnapshot(service);
  assert.equal(snapshot.contract, "analyticsData");
  assert.equal(snapshot.schema_version, "1.0");
  assert.equal(snapshot.consent.analytics, true);
  assert.equal(snapshot.event_count, 2); // consent.update + add_to_cart
  assert.equal(snapshot.last_event?.event_name, "commerce.add_to_cart");
  assert.equal(snapshot.events.length, 2);
  const gtm = snapshot.destinations.find((d) => d.name === "gtm");
  assert.deepEqual(gtm, {
    name: "gtm",
    label: "Google Tag Manager",
    consent_category: "analytics",
    configured: true,
  });
});

test("snapshot is vendor-neutral: canonical keys only, no GTM/GA4/Adobe shapes", () => {
  const service = makeService();
  service.updateConsent("accept_all");
  service.track("commerce.add_to_cart", { commerce: COMMERCE });
  const serialized = JSON.stringify(buildAnalyticsDataSnapshot(service));
  for (const vendorToken of [
    '"ecommerce"',
    "item_id",
    "item_name",
    "analytics_storage",
    "ad_storage",
    "gtag",
    "gtm.start",
    "eVar",
    "XDM",
  ]) {
    assert.ok(!serialized.includes(vendorToken), `snapshot must not contain ${vendorToken}`);
  }
  assert.ok(serialized.includes('"product_id"'), "canonical item naming present");
});

test("snapshot is NOT an alias of the GTM dataLayer", () => {
  const win: GtmWindow = {};
  const service = makeService(win);
  service.updateConsent("accept_all");
  service.track("commerce.add_to_cart", { commerce: COMMERCE });

  const snapshot = buildAnalyticsDataSnapshot(service);
  assert.ok(Array.isArray(win.dataLayer), "GTM adapter owns its own dataLayer");
  assert.notEqual(snapshot as unknown, win.dataLayer);
  assert.equal(Array.isArray(snapshot), false, "snapshot is a structured object, not a push queue");
  // dataLayer speaks GA4; the snapshot speaks canonical.
  const dlSerialized = JSON.stringify(win.dataLayer, (_k, v) =>
    typeof v === "object" && v !== null && "length" in v && !Array.isArray(v) ? Array.from(v as ArrayLike<unknown>) : v,
  );
  assert.ok(dlSerialized.includes("add_to_cart") && dlSerialized.includes("item_id"));
  assert.ok(!JSON.stringify(snapshot).includes("item_id"));
});

test("snapshot is deep-frozen and mutation attempts cannot touch internal state", () => {
  const service = makeService();
  service.updateConsent("accept_all");
  service.track("commerce.add_to_cart", { commerce: COMMERCE });

  const snapshot = buildAnalyticsDataSnapshot(service);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.last_event));
  assert.ok(Object.isFrozen(snapshot.last_event?.commerce?.items?.[0]));
  assert.throws(() => {
    "use strict";
    (snapshot as { event_count: number }).event_count = 999;
  });
  // Even if freezing were bypassed, snapshots are copies: internal log unaffected.
  const again = buildAnalyticsDataSnapshot(service);
  assert.equal(again.event_count, 2);
  assert.notEqual(again.last_event, snapshot.last_event, "each access returns fresh copies");
});

test("installed window.analyticsData is getter-only and always current", () => {
  const service = makeService();
  const fakeWindow: Record<string, unknown> = {};
  installAnalyticsDataInspector(service, fakeWindow);

  const first = fakeWindow.analyticsData as ReturnType<typeof buildAnalyticsDataSnapshot>;
  assert.equal(first.contract, "analyticsData");
  assert.equal(first.event_count, 0);

  service.updateConsent("accept_all");
  service.track("commerce.add_to_cart", { commerce: COMMERCE });
  const second = fakeWindow.analyticsData as ReturnType<typeof buildAnalyticsDataSnapshot>;
  assert.equal(second.event_count, 2, "getter reflects new events without re-install");

  // Assignment must not replace the getter.
  assert.throws(() => {
    "use strict";
    (fakeWindow as { analyticsData: unknown }).analyticsData = { hacked: true };
  });
  const third = fakeWindow.analyticsData as ReturnType<typeof buildAnalyticsDataSnapshot>;
  assert.equal(third.contract, "analyticsData");
});

test("snapshot inherits PII scrubbing from the canonical boundary", () => {
  const service = makeService();
  service.updateConsent("accept_all");
  service.track("commerce.add_to_cart", {
    commerce: {
      currency: "USD",
      items: [
        // @ts-expect-error — deliberately smuggled PII
        { product_id: "p1", name: "Lamp", email: "leak@example.com", price: 1, quantity: 1 },
      ],
    },
  });
  const serialized = JSON.stringify(buildAnalyticsDataSnapshot(service));
  assert.ok(!serialized.includes("leak@example.com"));
  assert.ok(serialized.includes("[redacted]"));
});
