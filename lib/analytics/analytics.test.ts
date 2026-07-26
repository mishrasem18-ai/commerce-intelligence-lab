/**
 * Central analytics service tests: envelope creation, PII protection at the
 * service boundary, consent integration, auth events without PII.
 * Run: npm run test:analytics
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnalytics } from "./analytics.ts";
import { createConsentStore, type ConsentStorage } from "./consent.ts";
import { ANALYTICS_SCHEMA_VERSION } from "./schema.ts";
import type { AnalyticsAdapter } from "./adapters/types.ts";
import type { AnalyticsData } from "./schema.ts";

function memoryStorage(): ConsentStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function fakeAdapter(): { adapter: AnalyticsAdapter; received: AnalyticsData[] } {
  const received: AnalyticsData[] = [];
  return {
    received,
    adapter: {
      name: "vendor",
      label: "Vendor",
      consentCategory: "analytics",
      isConfigured: () => true,
      track: (event) => {
        received.push(event);
      },
    },
  };
}

function makeService(adapter?: AnalyticsAdapter) {
  let id = 0;
  return createAnalytics({
    adapters: adapter ? [adapter] : [],
    consentStore: createConsentStore(memoryStorage()),
    environment: "test",
    getPageContext: () => ({
      path: "/shop",
      title: "Shop · Aurora Market",
      page_type: "product_list",
      query_string: "category=gaming",
    }),
    now: () => "2026-07-26T10:00:00.000Z",
    createId: () => `evt-${++id}`,
  });
}

test("track builds a complete canonical envelope", () => {
  const service = makeService();
  const record = service.track("commerce.add_to_cart", {
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
  });
  assert.ok(record);
  const { event } = record!;
  assert.equal(event.event_name, "commerce.add_to_cart");
  assert.equal(event.event_id, "evt-1");
  assert.equal(event.timestamp, "2026-07-26T10:00:00.000Z");
  assert.equal(event.schema_version, ANALYTICS_SCHEMA_VERSION);
  assert.equal(event.page.page_type, "product_list");
  assert.equal(event.user.authentication_state, "guest");
  assert.deepEqual(event.consent, {
    necessary: true,
    analytics: false,
    advertising: false,
    personalization: false,
  });
  assert.equal(event.app.name, "aurora-market");
  assert.equal(event.commerce?.items?.[0].name, "Halo Desk Lamp");
});

test("every event gets a unique event id", () => {
  const service = makeService();
  const a = service.track("page.view");
  const b = service.track("page.view");
  assert.ok(a && b);
  assert.notEqual(a!.event.event_id, b!.event.event_id);
});

test("events are blocked from adapters until analytics consent is granted, then delivered", () => {
  const { adapter, received } = fakeAdapter();
  const service = makeService(adapter);

  service.track("page.view");
  assert.equal(received.length, 0, "denied consent must block vendor dispatch");

  service.updateConsent("accept_all");
  service.track("page.view");
  assert.equal(received.length, 2, "consent.update + page.view delivered after grant");
});

test("updateConsent emits a canonical consent.update carrying the new state", () => {
  const service = makeService();
  service.updateConsent("custom", { analytics: true });
  const log = service.dispatcher.getLog();
  const consentEvent = log.find((r) => r.event.event_name === "consent.update");
  assert.ok(consentEvent);
  assert.equal(consentEvent!.event.consent_change?.method, "custom");
  assert.equal(consentEvent!.event.consent_change?.categories.analytics, true);
  // The envelope's own consent snapshot reflects the post-decision state.
  assert.equal(consentEvent!.event.consent.analytics, true);
});

test("consent events remain internally observable while adapters are blocked", () => {
  const { adapter, received } = fakeAdapter();
  const service = makeService(adapter);
  service.updateConsent("reject_all");
  assert.equal(received.length, 0);
  const log = service.dispatcher.getLog();
  assert.equal(log[log.length - 1].event.event_name, "consent.update");
});

test("user context is whitelisted to authentication_state and customer_id", () => {
  const service = makeService();
  service.setUserContext({
    authentication_state: "authenticated",
    customer_id: "C-AB12CD",
    // @ts-expect-error — deliberately smuggling PII through the seam
    email: "buyer@example.com",
    name: "Repro Tester",
  });
  const record = service.track("page.view");
  assert.deepEqual(record!.event.user, {
    authentication_state: "authenticated",
    customer_id: "C-AB12CD",
  });
});

test("login/sign_up events carry identity context but zero PII", () => {
  const service = makeService();
  service.setUserContext({
    authentication_state: "authenticated",
    customer_id: "C-AB12CD",
  });
  for (const name of ["user.login", "user.sign_up", "user.logout"] as const) {
    const record = service.track(name);
    assert.ok(record);
    const serialized = JSON.stringify(record!.event);
    assert.ok(!serialized.includes("@"), `${name} must not contain an email`);
    assert.ok(!/password|token|cookie/i.test(serialized));
    assert.equal(record!.event.user.customer_id, "C-AB12CD");
  }
});

test("PII sneaking into a payload is redacted before dispatch", () => {
  const { adapter, received } = fakeAdapter();
  const service = makeService(adapter);
  service.updateConsent("accept_all");
  const record = service.track("commerce.add_to_cart", {
    commerce: {
      currency: "USD",
      items: [
        // @ts-expect-error — deliberately malformed item with PII
        { product_id: "prod-1", name: "Lamp", email: "leak@example.com", price: 1, quantity: 1 },
      ],
    },
  });
  assert.ok(record!.piiViolations.length > 0);
  const delivered = received[received.length - 1];
  assert.ok(!JSON.stringify(delivered).includes("leak@example.com"));
});

test("track never throws, even when internals fail", () => {
  const service = createAnalytics({
    consentStore: createConsentStore(memoryStorage()),
    getPageContext: () => {
      throw new Error("page context unavailable");
    },
  });
  assert.doesNotThrow(() => {
    const record = service.track("page.view");
    assert.equal(record, null);
  });
});
