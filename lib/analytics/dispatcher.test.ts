/**
 * Dispatcher tests: consent gating, adapter failure isolation, honest status.
 * Run: npm run test:analytics
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createDispatcher } from "./dispatcher.ts";
import type { AnalyticsAdapter } from "./adapters/types.ts";
import type { AnalyticsData } from "./schema.ts";
import type { ConsentState } from "./consent.ts";

function makeEvent(): AnalyticsData {
  return {
    event_name: "commerce.add_to_cart",
    event_id: "evt-1",
    timestamp: "2026-07-26T10:00:00.000Z",
    schema_version: "1.0",
    page: { path: "/shop", title: "Shop", page_type: "product_list", query_string: "" },
    user: { authentication_state: "guest" },
    consent: { necessary: true, analytics: false, advertising: false, personalization: false },
    app: { name: "aurora-market", environment: "test" },
  };
}

function consentWith(analytics: boolean): ConsentState {
  return { necessary: true, analytics, advertising: false, personalization: false };
}

function fakeAdapter(
  name: string,
  options: { configured?: boolean; failing?: boolean } = {},
): { adapter: AnalyticsAdapter; received: AnalyticsData[] } {
  const received: AnalyticsData[] = [];
  return {
    received,
    adapter: {
      name,
      label: name,
      consentCategory: "analytics",
      isConfigured: () => options.configured ?? true,
      track: (event) => {
        if (options.failing) throw new Error(`${name} exploded`);
        received.push(event);
      },
    },
  };
}

test("events are blocked when analytics consent is denied", () => {
  const { adapter, received } = fakeAdapter("vendor");
  const dispatcher = createDispatcher({
    adapters: [adapter],
    getConsent: () => consentWith(false),
  });
  const record = dispatcher.dispatch(makeEvent());
  assert.equal(received.length, 0);
  assert.equal(record.results[0].status, "blocked_by_consent");
});

test("events are delivered when analytics consent is granted", () => {
  const { adapter, received } = fakeAdapter("vendor");
  const dispatcher = createDispatcher({
    adapters: [adapter],
    getConsent: () => consentWith(true),
  });
  const record = dispatcher.dispatch(makeEvent());
  assert.equal(received.length, 1);
  assert.equal(record.results[0].status, "delivered");
});

test("unconfigured adapters report not_configured and never receive events", () => {
  const { adapter, received } = fakeAdapter("vendor", { configured: false });
  const dispatcher = createDispatcher({
    adapters: [adapter],
    getConsent: () => consentWith(true),
  });
  const record = dispatcher.dispatch(makeEvent());
  assert.equal(received.length, 0);
  assert.equal(record.results[0].status, "not_configured");
});

test("a throwing adapter is isolated: dispatch survives and others deliver", () => {
  const broken = fakeAdapter("broken", { failing: true });
  const healthy = fakeAdapter("healthy");
  const dispatcher = createDispatcher({
    adapters: [broken.adapter, healthy.adapter],
    getConsent: () => consentWith(true),
  });

  let record: ReturnType<typeof dispatcher.dispatch> | null = null;
  assert.doesNotThrow(() => {
    record = dispatcher.dispatch(makeEvent());
  });
  assert.ok(record);
  assert.equal(record!.results.find((r) => r.adapter === "broken")?.status, "error");
  assert.equal(record!.results.find((r) => r.adapter === "healthy")?.status, "delivered");
  assert.equal(healthy.received.length, 1);
});

test("a failing getConsent fails CLOSED (no external dispatch)", () => {
  const { adapter, received } = fakeAdapter("vendor");
  const dispatcher = createDispatcher({
    adapters: [adapter],
    getConsent: () => {
      throw new Error("consent unavailable");
    },
  });
  const record = dispatcher.dispatch(makeEvent());
  assert.equal(received.length, 0);
  assert.equal(record.results[0].status, "blocked_by_consent");
});

test("every canonical event is observable in the internal log regardless of consent", () => {
  const dispatcher = createDispatcher({
    adapters: [fakeAdapter("vendor").adapter],
    getConsent: () => consentWith(false),
  });
  dispatcher.dispatch(makeEvent());
  dispatcher.dispatch(makeEvent());
  assert.equal(dispatcher.getLog().length, 2);
});

test("a consent change never replays previously blocked or delivered events", () => {
  let analyticsGranted = false;
  const { adapter, received } = fakeAdapter("vendor");
  const dispatcher = createDispatcher({
    adapters: [adapter],
    getConsent: () => consentWith(analyticsGranted),
  });

  // Event fired while denied: blocked, and stays blocked forever.
  dispatcher.dispatch(makeEvent());
  assert.equal(received.length, 0);

  // Consent flips to granted (adapters get the consent signal only).
  analyticsGranted = true;
  dispatcher.notifyConsent(consentWith(true));
  assert.equal(received.length, 0, "granting consent must not replay the blocked event");

  // Only a NEW dispatch is delivered — exactly once.
  dispatcher.dispatch(makeEvent());
  assert.equal(received.length, 1);

  // Flipping consent again re-delivers nothing.
  analyticsGranted = false;
  dispatcher.notifyConsent(consentWith(false));
  analyticsGranted = true;
  dispatcher.notifyConsent(consentWith(true));
  assert.equal(received.length, 1, "consent churn must not re-deliver past events");
});

test("log subscribers are notified and the log can be cleared", () => {
  const dispatcher = createDispatcher({ adapters: [], getConsent: () => consentWith(true) });
  let notifications = 0;
  dispatcher.subscribe(() => {
    notifications += 1;
  });
  dispatcher.dispatch(makeEvent());
  dispatcher.clearLog();
  assert.equal(notifications, 2);
  assert.equal(dispatcher.getLog().length, 0);
});
