/**
 * Site-search tracking: exactly one canonical search.submit per deliberate
 * search, normalised, PII-redacted before any adapter.
 * Run: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSearchContext,
  createSearchTracker,
  MAX_SEARCH_TERM_LENGTH,
  normalizeSearchTerm,
} from "./search.ts";
import { createAnalytics } from "./analytics.ts";
import { createConsentStore } from "./consent.ts";
import { createGtmAdapter, mapEventToDataLayer, type GtmWindow } from "./adapters/gtm-adapter.ts";
import type { SearchContext } from "./schema.ts";

function harness(entryUrl: string | null = "/") {
  const tracked: SearchContext[] = [];
  const tracker = createSearchTracker({ track: (s) => tracked.push(s), entryUrl: () => entryUrl });
  return { tracker, tracked };
}

test("terms are normalised: NFKC, trimmed, collapsed, lower-cased, capped", () => {
  assert.equal(normalizeSearchTerm("  Wireless   HEADPHONES \n"), "wireless headphones");
  assert.equal(normalizeSearchTerm("ｌａｍｐ"), "lamp"); // full-width → ASCII
  assert.equal(normalizeSearchTerm("x".repeat(500)).length, MAX_SEARCH_TERM_LENGTH);
  assert.equal(buildSearchContext("   ", 3, "shop"), null);
});

test("context carries count, source and zero_results", () => {
  assert.deepEqual(buildSearchContext("Lamp", 4, "header"), {
    query: "lamp",
    results_count: 4,
    search_source: "header",
    zero_results: false,
  });
  assert.equal(buildSearchContext("zzz", 0, "shop")!.zero_results, true);
});

test("one event per deliberate submit; identical repeats are ignored", () => {
  const { tracker, tracked } = harness();
  tracker.submit("lamp", 4, "shop");
  tracker.submit("  LAMP ", 4, "shop"); // Enter pressed again, same term/results
  tracker.submit("lamp", 2, "shop"); // results changed (filter) → a new search
  tracker.submit("desk", 5, "shop");
  tracker.submit("lamp", 2, "shop");
  tracker.submit("", 0, "shop"); // empty never fires
  assert.deepEqual(
    tracked.map((s) => `${s.query}:${s.results_count}`),
    ["lamp:4", "lamp:2", "desk:5", "lamp:2"],
  );
});

test("a suggestion is its own signal, not a duplicate plain submit", () => {
  const { tracker, tracked } = harness();
  tracker.submit("head", 6, "suggestion");
  assert.deepEqual(tracked.map((s) => s.search_source), ["suggestion"]);
});

test("header submit then arriving on /shop?q= fires once (header only)", () => {
  // The document was loaded on /cart; the header pushes to /shop?q=lamp.
  const { tracker, tracked } = harness("/cart");
  tracker.submit("lamp", 4, "header");
  tracker.landed("/shop?q=lamp", "lamp", 4);
  assert.deepEqual(tracked.map((s) => s.search_source), ["header"]);
});

test("a deep link / refresh on /shop?q= fires once with source url", () => {
  const { tracker, tracked } = harness("/shop?q=Lamp&category=home");
  tracker.landed("/shop?category=home&q=Lamp", "Lamp", 3); // param order irrelevant
  tracker.landed("/shop?category=home&q=Lamp", "Lamp", 3); // Strict Mode / re-render
  tracker.landed("/shop?q=desk", "desk", 5); // later client navigation: not a landing
  assert.deepEqual(tracked, [
    { query: "lamp", results_count: 3, search_source: "url", zero_results: false },
  ]);
});

test("back/forward to the entry URL after leaving never re-fires", () => {
  const { tracker, tracked } = harness("/shop?q=lamp");
  tracker.landed("/shop?q=lamp", "lamp", 4);
  tracker.landed("/product/prod-1", "", 0);
  tracker.landed("/shop?q=lamp", "lamp", 4); // history traversal back
  assert.equal(tracked.length, 1);
});

test("unknown entry URL: no url search is inferred", () => {
  const { tracker, tracked } = harness(null);
  tracker.landed("/shop?q=lamp", "lamp", 4);
  assert.equal(tracked.length, 0);
});

test("email/phone-like terms are redacted before any adapter sees them", () => {
  const win: GtmWindow = { location: { origin: "https://aurora.example" } };
  const service = createAnalytics({
    adapters: [createGtmAdapter({ containerId: "GTM-TEST123", win, injectScript: () => {} })],
    consentStore: createConsentStore(null),
    environment: "test",
    getPageContext: () => ({ path: "/shop", title: "Shop · Aurora Market", page_type: "product_list", query_string: "" }),
  });
  service.updateConsent("accept_all");
  const tracker = createSearchTracker({
    track: (search) => service.track("search.submit", { search }),
    entryUrl: () => null,
  });
  tracker.submit("jane.doe@example.com", 0, "header");
  tracker.submit("+44 20 7946 0958", 0, "shop");
  const log = service.dispatcher.getLog().filter((r) => r.event.event_name === "search.submit");
  assert.deepEqual(log.map((r) => r.event.search!.query), ["[redacted]", "[redacted]"]);
  const pushed = JSON.stringify(win.dataLayer);
  assert.ok(!pushed.includes("jane"));
  assert.ok(!pushed.includes("7946"));
});

test("GTM mapping exposes the search keys", () => {
  const mapped = mapEventToDataLayer({
    event_name: "search.submit",
    event_id: "e1",
    timestamp: "2026-07-26T10:00:00.000Z",
    schema_version: "1.0",
    page: { path: "/shop", title: "Shop · Aurora Market", page_type: "product_list", query_string: "q=lamp" },
    user: { authentication_state: "guest" },
    consent: { necessary: true, analytics: true, advertising: false, personalization: false },
    app: { name: "aurora-market", environment: "test" },
    search: { query: "lamp", results_count: 0, search_source: "url", zero_results: true },
  });
  assert.equal(mapped.event, "search");
  assert.equal(mapped.search_term, "lamp");
  assert.equal(mapped.search_results_count, 0);
  assert.equal(mapped.search_source, "url");
  assert.equal(mapped.search_zero_results, true);
});
