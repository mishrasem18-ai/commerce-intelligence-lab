/**
 * GTM adapter tests (Phase 2A). All "configured" cases use a FAKE container
 * ID and a fake window — no real GTM container exists anywhere in this repo
 * and no script/network activity happens in tests.
 * Run: npm run test:analytics
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_MODE_DEFAULT,
  consentToGoogleConsentMode,
  createGtmAdapter,
  isValidContainerId,
  mapEventToDataLayer,
  type GtmWindow,
} from "./gtm-adapter.ts";
import { createAnalytics } from "../analytics.ts";
import { createConsentStore } from "../consent.ts";
import type { AnalyticsData } from "../schema.ts";

const FAKE_ID = "GTM-TEST123"; // test fixture only — not a real container

function makeEvent(overrides: Partial<AnalyticsData> = {}): AnalyticsData {
  return {
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
    ...overrides,
  };
}

function makeHarness(options: { containerId?: string } = {}) {
  const win: GtmWindow = {};
  const injected: string[] = [];
  const adapter = createGtmAdapter({
    containerId: options.containerId,
    win,
    injectScript: (id) => injected.push(id),
  });
  return { win, injected, adapter };
}

/** Consent-command pushes are `arguments` objects: ["consent", verb, params]. */
function consentCommands(win: GtmWindow): Array<{ verb: string; params: unknown }> {
  return (win.dataLayer ?? [])
    .filter((entry): entry is IArguments => typeof entry === "object" && entry !== null && !Array.isArray(entry) && "length" in entry && (entry as IArguments)[0] === "consent")
    .map((entry) => ({ verb: (entry as IArguments)[1] as string, params: (entry as IArguments)[2] }));
}

test("container id validation", () => {
  assert.equal(isValidContainerId("GTM-ABC1234"), true);
  assert.equal(isValidContainerId(undefined), false);
  assert.equal(isValidContainerId(""), false);
  assert.equal(isValidContainerId("G-12345678"), false); // GA4 stream id, not a container
  assert.equal(isValidContainerId("gtm-abc1234"), false);
});

test("without a container id the adapter stays not configured and inert (Phase 1 default)", () => {
  const { win, injected, adapter } = makeHarness({});
  assert.equal(adapter.isConfigured(), false);
  adapter.initialize?.();
  adapter.track(makeEvent());
  // track still writes to the local dataLayer seam only if window exists; the
  // key guarantees are: no script injection and not configured.
  assert.equal(injected.length, 0);
  assert.equal(consentCommands(win).length, 0);
});

test("initialize pushes Consent Mode default (all denied) BEFORE gtm.start, then injects the script once", () => {
  const { win, injected, adapter } = makeHarness({ containerId: FAKE_ID });
  assert.equal(adapter.isConfigured(), true);
  adapter.initialize?.();
  adapter.initialize?.(); // idempotent

  assert.deepEqual(injected, [FAKE_ID]);
  const dl = win.dataLayer ?? [];
  const consentIndex = dl.findIndex(
    (e) => typeof e === "object" && e !== null && (e as IArguments)[0] === "consent",
  );
  const startIndex = dl.findIndex(
    (e) => typeof e === "object" && e !== null && "gtm.start" in (e as Record<string, unknown>),
  );
  assert.ok(consentIndex !== -1 && startIndex !== -1);
  assert.ok(consentIndex < startIndex, "consent default must precede gtm.start");

  const [defaultCmd] = consentCommands(win);
  assert.equal(defaultCmd.verb, "default");
  assert.deepEqual(defaultCmd.params, CONSENT_MODE_DEFAULT);
});

test("consentToGoogleConsentMode maps each neutral category to its Google signals", () => {
  assert.deepEqual(
    consentToGoogleConsentMode({
      necessary: true,
      analytics: true,
      advertising: false,
      personalization: true,
    }),
    {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "granted",
      personalization_storage: "granted",
      functionality_storage: "granted",
      security_storage: "granted",
    },
  );
  const allDenied = consentToGoogleConsentMode({
    necessary: true,
    analytics: false,
    advertising: false,
    personalization: false,
  });
  assert.equal(allDenied.analytics_storage, "denied");
  assert.equal(allDenied.security_storage, "granted");
});

test("onConsentChange pushes a consent update — including a DENIED one", () => {
  const { win, adapter } = makeHarness({ containerId: FAKE_ID });
  adapter.initialize?.();
  adapter.onConsentChange?.({
    necessary: true,
    analytics: true,
    advertising: false,
    personalization: false,
  });
  adapter.onConsentChange?.({
    necessary: true,
    analytics: false,
    advertising: false,
    personalization: false,
  });
  const updates = consentCommands(win).filter((c) => c.verb === "update");
  assert.equal(updates.length, 2);
  assert.equal((updates[0].params as Record<string, string>).analytics_storage, "granted");
  assert.equal((updates[1].params as Record<string, string>).analytics_storage, "denied");
});

test("onConsentChange before initialize is a no-op (no orphan pushes)", () => {
  const { win, adapter } = makeHarness({ containerId: FAKE_ID });
  adapter.onConsentChange?.({
    necessary: true,
    analytics: true,
    advertising: false,
    personalization: false,
  });
  assert.equal(consentCommands(win).length, 0);
});

test("track resets ecommerce then pushes the GA4-shaped payload", () => {
  const { win, adapter } = makeHarness({ containerId: FAKE_ID });
  adapter.initialize?.();
  adapter.track(makeEvent());

  const dl = win.dataLayer ?? [];
  const resetIndex = dl.findIndex(
    (e) => typeof e === "object" && e !== null && (e as Record<string, unknown>).ecommerce === null,
  );
  const eventEntry = dl[dl.length - 1] as {
    event: string;
    ecommerce: { items: Array<{ item_id: string }> };
  };
  assert.ok(resetIndex !== -1, "must push {ecommerce: null} before an ecommerce event");
  assert.ok(resetIndex < dl.length - 1);
  assert.equal(eventEntry.event, "add_to_cart");
  assert.equal(eventEntry.ecommerce.items[0].item_id, "prod-1001");
});

test("non-commerce events push without an ecommerce reset", () => {
  const { win, adapter } = makeHarness({ containerId: FAKE_ID });
  adapter.initialize?.();
  adapter.track(makeEvent({ event_name: "page.view", commerce: undefined }));
  const dl = win.dataLayer ?? [];
  assert.equal(
    dl.some((e) => typeof e === "object" && e !== null && (e as Record<string, unknown>).ecommerce === null),
    false,
  );
  assert.equal((dl[dl.length - 1] as { event: string }).event, "page_view");
});

test("purchase maps order fields onto the GA4 transaction shape", () => {
  const pushed = mapEventToDataLayer(
    makeEvent({
      event_name: "commerce.purchase",
      commerce: {
        currency: "USD",
        order_id: "ORD-C4D4D66",
        value: 237.59,
        tax: 17.6,
        shipping: 0,
        payment_method: "Card",
        item_count: 1,
        items: [],
      },
    }),
  ) as { event: string; ecommerce: Record<string, unknown> };
  assert.equal(pushed.event, "purchase");
  assert.equal(pushed.ecommerce.transaction_id, "ORD-C4D4D66");
  assert.equal(pushed.ecommerce.value, 237.59);
  assert.equal(pushed.ecommerce.tax, 17.6);
  assert.equal(pushed.ecommerce.payment_type, "Card");
});

test("integration: dispatcher gates track by consent while consent updates still flow", () => {
  const { win, adapter } = makeHarness({ containerId: FAKE_ID });
  const service = createAnalytics({
    adapters: [adapter],
    consentStore: createConsentStore(null),
    environment: "test",
    getPageContext: () => ({ path: "/", title: "Home", page_type: "home", query_string: "" }),
  });

  const eventsIn = () =>
    (win.dataLayer ?? []).filter(
      (e) => typeof e === "object" && e !== null && typeof (e as Record<string, unknown>).event === "string" && (e as Record<string, unknown>).event !== "gtm.js",
    );

  // Denied: no event pushes, but the startup consent signal reached Google.
  const denied = service.track("page.view");
  assert.equal(denied!.results[0].status, "blocked_by_consent");
  assert.equal(eventsIn().length, 0);
  const startupUpdates = consentCommands(win).filter((c) => c.verb === "update");
  assert.equal(startupUpdates.length, 1, "persisted consent state is signalled at startup");

  // Granting consent: an update flows AND subsequent events deliver.
  service.updateConsent("accept_all");
  const granted = service.track("page.view");
  assert.equal(granted!.results[0].status, "delivered");
  const updates = consentCommands(win).filter((c) => c.verb === "update");
  assert.equal((updates[updates.length - 1].params as Record<string, string>).analytics_storage, "granted");
  assert.ok(eventsIn().length >= 2, "consent.update + page.view delivered after grant");
});

test("no PII reaches the dataLayer through the full pipeline", () => {
  const { win, adapter } = makeHarness({ containerId: FAKE_ID });
  const service = createAnalytics({
    adapters: [adapter],
    consentStore: createConsentStore(null),
    environment: "test",
    getPageContext: () => ({ path: "/", title: "Home", page_type: "home", query_string: "" }),
  });
  service.updateConsent("accept_all");
  service.setUserContext({ authentication_state: "authenticated", customer_id: "C-AB12CD" });
  service.track("commerce.add_to_cart", {
    commerce: {
      currency: "USD",
      items: [
        // @ts-expect-error — deliberately malformed item smuggling PII
        { product_id: "p1", name: "Lamp", email: "leak@example.com", price: 1, quantity: 1 },
      ],
    },
  });
  const serialized = JSON.stringify(win.dataLayer, (_k, v) =>
    typeof v === "object" && v !== null && "length" in v && !Array.isArray(v) ? Array.from(v as ArrayLike<unknown>) : v,
  );
  assert.ok(!serialized.includes("leak@example.com"));
  assert.ok(serialized.includes("C-AB12CD"), "pseudonymous id is allowed");
});

test("page_location is rebuilt from the scrubbed path + query, never the raw URL", () => {
  const win: GtmWindow = { location: { origin: "https://aurora.example" } };
  const adapter = createGtmAdapter({ containerId: FAKE_ID, win, injectScript: () => {} });
  const service = createAnalytics({
    adapters: [adapter],
    consentStore: createConsentStore(null),
    environment: "test",
    getPageContext: () => ({
      path: "/account/orders/jane%40example.com",
      title: "Order Detail · Aurora Market",
      page_type: "account",
      query_string: "q=jane%40example.com&page=2",
    }),
  });
  service.updateConsent("accept_all");
  service.track("page.view");
  const pageView = (win.dataLayer ?? []).find(
    (e) => (e as Record<string, unknown>).event === "page_view",
  ) as Record<string, unknown>;
  assert.equal(pageView.page_path, "/account/orders/[redacted]");
  assert.equal(
    pageView.page_location,
    "https://aurora.example/account/orders/[redacted]?q=[redacted]&page=2",
  );
  assert.equal(pageView.page_title, "Order Detail · Aurora Market");
  assert.ok(!JSON.stringify(win.dataLayer).includes("jane"));
});

test("page_location is omitted when no origin is known (pure mapping)", () => {
  const mapped = mapEventToDataLayer(makeEvent());
  assert.equal("page_location" in mapped, false);
  const withOrigin = mapEventToDataLayer(
    makeEvent({ page: { path: "/shop", title: "Shop · Aurora Market", page_type: "product_list", query_string: "category=home" } }),
    { origin: "https://aurora.example" },
  );
  assert.equal(withOrigin.page_location, "https://aurora.example/shop?category=home");
});
