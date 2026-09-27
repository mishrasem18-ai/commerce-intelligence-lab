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
import { gtmDataModel } from "../../../test/gtm-data-model.mjs";

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

test("page_location is cleared when no origin is known (pure mapping)", () => {
  const mapped = mapEventToDataLayer(makeEvent());
  assert.equal("page_location" in mapped, true);
  assert.equal(mapped.page_location, undefined);
  const withOrigin = mapEventToDataLayer(
    makeEvent({ page: { path: "/shop", title: "Shop · Aurora Market", page_type: "product_list", query_string: "category=home" } }),
    { origin: "https://aurora.example" },
  );
  assert.equal(withOrigin.page_location, "https://aurora.example/shop?category=home");
});

test("page_referrer is scrubbed: document referrer first, then the previous page_location", () => {
  const win: GtmWindow = {
    location: { origin: "https://aurora.example" },
    document: { referrer: "https://aurora.example/shop?q=jane.doe%40example.com&category=home" },
  };
  const adapter = createGtmAdapter({ containerId: FAKE_ID, win, injectScript: () => {} });
  let page = { path: "/product/prod-1", title: "Lamp · Aurora Market", page_type: "product_detail" as const, query_string: "" };
  const service = createAnalytics({
    adapters: [adapter],
    consentStore: createConsentStore(null),
    environment: "test",
    getPageContext: () => page,
  });
  service.updateConsent("accept_all");
  service.track("page.view");
  service.track("commerce.view_item", { commerce: { currency: "USD", items: [] } });
  page = { path: "/cart", title: "Cart · Aurora Market", page_type: "cart" as const, query_string: "" };
  service.track("page.view");

  const pushes = (win.dataLayer ?? []).filter(
    (e) => typeof e === "object" && e !== null && "event_id" in (e as object),
  ) as Array<Record<string, unknown>>;
  assert.deepEqual(
    pushes.map((p) => [p.event, p.page_referrer]),
    [
      ["consent.update", undefined], // before the first page view: none yet
      ["page_view", "https://aurora.example/shop?q=[redacted]&category=home"],
      ["view_item", "https://aurora.example/shop?q=[redacted]&category=home"],
      ["page_view", "https://aurora.example/product/prod-1"],
    ],
  );
  assert.ok(!JSON.stringify(win.dataLayer).includes("jane"));
});

test("page_referrer is cleared, not invented, when the browser has none", () => {
  const win: GtmWindow = {
    location: { origin: "https://aurora.example" },
    document: { referrer: "" },
    // Stands in for any earlier value in GTM's data model.
    dataLayer: [{ page_referrer: "https://stale.example/" }],
  };
  const adapter = createGtmAdapter({ containerId: FAKE_ID, win, injectScript: () => {} });
  const service = createAnalytics({
    adapters: [adapter],
    consentStore: createConsentStore(null),
    environment: "test",
    getPageContext: () => ({ path: "/", title: "Home · Aurora Market", page_type: "home", query_string: "" }),
  });
  service.updateConsent("accept_all");
  service.track("page.view");
  const view = (win.dataLayer ?? []).find((e) => (e as Record<string, unknown>).event === "page_view") as Record<string, unknown>;
  assert.equal("page_referrer" in view, true);
  assert.equal(view.page_referrer, undefined);
  assert.equal(gtmDataModel(win.dataLayer ?? []).page_referrer, undefined);
});

/* -------------------------------------------------------------------------- */
/*  Stale keys: every push clears the keys its event doesn't carry           */
/* -------------------------------------------------------------------------- */

const OPTIONAL_KEYS = [
  "page_location",
  "page_referrer",
  "customer_id",
  "ecommerce",
  "search_term",
  "search_results_count",
  "search_source",
  "search_zero_results",
];
const SEARCH_KEYS = OPTIONAL_KEYS.filter((key) => key.startsWith("search_"));

/** The full pipeline with consent granted; `pushes()` lists the mapped events. */
function pipelineHarness() {
  const win: GtmWindow = { location: { origin: "https://aurora.example" }, document: { referrer: "" } };
  const adapter = createGtmAdapter({ containerId: FAKE_ID, win, injectScript: () => {} });
  let page = { path: "/", title: "Home · Aurora Market", page_type: "home" as const, query_string: "" };
  const service = createAnalytics({
    adapters: [adapter],
    consentStore: createConsentStore(null),
    environment: "test",
    getPageContext: () => page,
  });
  service.updateConsent("accept_all");
  return {
    win,
    service,
    navigate: (next: typeof page) => {
      page = next;
    },
    pushes: () =>
      (win.dataLayer ?? []).filter(
        (e) => typeof e === "object" && e !== null && "event_id" in (e as object),
      ) as Array<Record<string, unknown>>,
    model: () => gtmDataModel(win.dataLayer ?? []),
  };
}

test("every push carries every key; the ones its event lacks are undefined", () => {
  const options = { origin: "https://aurora.example", referrer: "https://aurora.example/" };
  const bare = mapEventToDataLayer(makeEvent({ event_name: "page.view", commerce: undefined }));
  const mapped = [
    bare,
    mapEventToDataLayer(
      makeEvent({ user: { authentication_state: "authenticated", customer_id: "C-AB12CD" } }),
      options,
    ),
    mapEventToDataLayer(
      makeEvent({
        event_name: "search.submit",
        commerce: undefined,
        search: { query: "qqqzzz", results_count: 0, search_source: "shop", zero_results: true },
      }),
      options,
    ),
    mapEventToDataLayer(makeEvent({ event_name: "user.logout", commerce: undefined }), options),
  ];
  const keys = Object.keys(bare).sort();
  assert.deepEqual(
    keys,
    ["event", "event_id", "page_path", "page_title", "page_type", ...OPTIONAL_KEYS].sort(),
  );
  for (const payload of mapped) assert.deepEqual(Object.keys(payload).sort(), keys);
  for (const key of OPTIONAL_KEYS) assert.equal(bare[key], undefined, key);
  // A falsy value is a value, not a missing one.
  assert.equal(mapped[2].search_results_count, 0);
});

test("customer_id is cleared on the first push after sign-out", () => {
  const { service, pushes, model } = pipelineHarness();
  service.setUserContext({ authentication_state: "authenticated", customer_id: "C-AB12CD" });
  service.track("page.view");
  // The auth store's order: track the logout while the id is set, then reset.
  service.track("user.logout");
  service.setUserContext({ authentication_state: "guest" });
  assert.equal(model().customer_id, "C-AB12CD");
  service.track("page.view");

  const [, signedIn, logout, next] = pushes();
  assert.deepEqual([signedIn.event, logout.event, next.event], ["page_view", "user.logout", "page_view"]);
  assert.equal(signedIn.customer_id, "C-AB12CD");
  assert.equal(logout.customer_id, "C-AB12CD");
  assert.equal("customer_id" in next, true);
  assert.equal(next.customer_id, undefined);
  assert.equal(model().customer_id, undefined);
});

test("the search keys are cleared on the next push after a search", () => {
  const { service, navigate, pushes, model } = pipelineHarness();
  service.track("search.submit", {
    search: { query: "desk", results_count: 7, search_source: "header", zero_results: false },
  });
  assert.deepEqual(
    SEARCH_KEYS.map((key) => model()[key]),
    ["desk", 7, "header", false],
  );
  navigate({ path: "/shop", title: "Shop · Aurora Market", page_type: "product_list", query_string: "q=desk" });
  service.track("page.view");
  service.track("commerce.view_item_list", { commerce: { currency: "USD", items: [] } });

  const [, search, view, list] = pushes();
  assert.deepEqual([search.event, view.event, list.event], ["search", "page_view", "view_item_list"]);
  for (const push of [view, list]) {
    for (const key of SEARCH_KEYS) {
      assert.equal(key in push, true, `${push.event} ${key}`);
      assert.equal(push[key], undefined, `${push.event} ${key}`);
    }
  }
  for (const key of SEARCH_KEYS) assert.equal(model()[key], undefined, key);
});

test("ecommerce is cleared on non-commerce pushes; commerce pushes keep the null reset", () => {
  const { win, service, pushes, model } = pipelineHarness();
  service.track("commerce.add_to_cart", {
    commerce: makeEvent().commerce!,
  });
  service.track("page.view");

  const dl = win.dataLayer ?? [];
  const addIndex = dl.findIndex((e) => (e as Record<string, unknown>).event === "add_to_cart");
  assert.deepEqual(dl[addIndex - 1], { ecommerce: null });
  assert.equal(
    dl.filter((e) => typeof e === "object" && e !== null && (e as Record<string, unknown>).ecommerce === null).length,
    1,
    "only the commerce event gets a null reset",
  );
  const view = pushes().at(-1)!;
  assert.equal(view.event, "page_view");
  assert.equal("ecommerce" in view, true);
  assert.equal(view.ecommerce, undefined);
  assert.equal(model().ecommerce, undefined);
});
