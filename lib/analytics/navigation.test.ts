/**
 * Logical-navigation identity tests: exactly one canonical page.view per
 * committed logical navigation, decided deterministically (no timing).
 * Run: npm run test:analytics
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decidePageView,
  findNavigationMarker,
  locationAfter,
  markerMatchesUrl,
  MAX_NAVIGATION_MARKERS,
  NAVIGATION_MARKER_KEY,
  recordNavigationMarker,
  type TrackedLocation,
} from "./navigation.ts";

/** Simulates the PageViewTracker effect loop: returns tracked URL sequence. */
function simulate(
  steps: Array<{
    pathname: string;
    url: string;
    navigationType: "push" | "replace" | "traverse" | "unknown" | "initial";
  }>,
): string[] {
  let last: TrackedLocation | null = null;
  const tracked: string[] = [];
  for (const step of steps) {
    const decision = decidePageView({
      last,
      nextPathname: step.pathname,
      nextUrl: step.url,
      navigationType: step.navigationType,
    });
    if (decision.track) tracked.push(step.url);
    last = locationAfter(decision, last, { pathname: step.pathname, url: step.url });
  }
  return tracked;
}

test("initial page load is tracked exactly once (Strict Mode double effect absorbed)", () => {
  const tracked = simulate([
    { pathname: "/", url: "/", navigationType: "initial" },
    { pathname: "/", url: "/", navigationType: "initial" }, // Strict Mode re-run
  ]);
  assert.deepEqual(tracked, ["/"]);
});

test("SPA navigation and pathname change: one page.view each", () => {
  const tracked = simulate([
    { pathname: "/", url: "/", navigationType: "initial" },
    { pathname: "/shop", url: "/shop?category=home", navigationType: "push" },
    { pathname: "/product/p1", url: "/product/p1", navigationType: "push" },
  ]);
  assert.deepEqual(tracked, ["/", "/shop?category=home", "/product/p1"]);
});

test("query-string navigation via push IS a navigation", () => {
  const tracked = simulate([
    { pathname: "/shop", url: "/shop?category=home", navigationType: "push" },
    { pathname: "/shop", url: "/shop?category=gaming", navigationType: "push" },
  ]);
  assert.deepEqual(tracked, ["/shop?category=home", "/shop?category=gaming"]);
});

test("same-pathname replace refinements (search keystrokes/filters) do NOT re-track", () => {
  const tracked = simulate([
    { pathname: "/shop", url: "/shop?category=home", navigationType: "push" },
    { pathname: "/shop", url: "/shop?category=home&q=l", navigationType: "replace" },
    { pathname: "/shop", url: "/shop?category=home&q=la", navigationType: "replace" },
    { pathname: "/shop", url: "/shop?category=home&q=lamp", navigationType: "replace" },
    { pathname: "/shop", url: "/shop?category=home&q=lamp&page=2", navigationType: "replace" },
  ]);
  assert.deepEqual(tracked, ["/shop?category=home"], "one logical navigation, one page.view");
});

test("replace that CHANGES pathname is a real navigation (auth redirects)", () => {
  const tracked = simulate([
    { pathname: "/login", url: "/login?redirect=/checkout", navigationType: "push" },
    { pathname: "/checkout", url: "/checkout", navigationType: "replace" },
  ]);
  assert.deepEqual(tracked, ["/login?redirect=/checkout", "/checkout"]);
});

test("back and forward traversals are navigations; each direction tracked once", () => {
  const tracked = simulate([
    { pathname: "/", url: "/", navigationType: "initial" },
    { pathname: "/shop", url: "/shop?category=home", navigationType: "push" },
    { pathname: "/", url: "/", navigationType: "traverse" }, // back
    { pathname: "/shop", url: "/shop?category=home", navigationType: "traverse" }, // forward
  ]);
  assert.deepEqual(tracked, ["/", "/shop?category=home", "/", "/shop?category=home"]);
});

test("repeated click to the current URL never duplicates", () => {
  const tracked = simulate([
    { pathname: "/shop", url: "/shop?category=home", navigationType: "push" },
    { pathname: "/shop", url: "/shop?category=home", navigationType: "push" },
    { pathname: "/shop", url: "/shop?category=home", navigationType: "unknown" },
  ]);
  assert.deepEqual(tracked, ["/shop?category=home"]);
});

test("React remount mid-session does not re-track the current URL", () => {
  // A remount re-runs the effect with unchanged URL and no fresh marker.
  const tracked = simulate([
    { pathname: "/cart", url: "/cart", navigationType: "push" },
    { pathname: "/cart", url: "/cart", navigationType: "unknown" }, // remount re-run
  ]);
  assert.deepEqual(tracked, ["/cart"]);
});

test("unknown navigation type fails OPEN (tracks) for a genuinely new URL", () => {
  const tracked = simulate([
    { pathname: "/", url: "/", navigationType: "initial" },
    { pathname: "/shop", url: "/shop?category=home", navigationType: "unknown" },
  ]);
  assert.deepEqual(tracked, ["/", "/shop?category=home"]);
});

test("ecommerce navigation chain produces exactly one page.view per step", () => {
  const tracked = simulate([
    { pathname: "/", url: "/", navigationType: "initial" },
    { pathname: "/shop", url: "/shop?category=gaming", navigationType: "push" },
    { pathname: "/product/prod-1048", url: "/product/prod-1048", navigationType: "push" },
    { pathname: "/cart", url: "/cart", navigationType: "push" },
    { pathname: "/checkout", url: "/checkout", navigationType: "push" },
  ]);
  assert.equal(tracked.length, 5);
  assert.equal(new Set(tracked).size, 5, "no URL tracked twice");
});

test("marker matching accepts full hrefs and plain paths; garbage fails closed", () => {
  assert.equal(
    markerMatchesUrl("https://example.com/shop?category=home", "/shop?category=home"),
    true,
  );
  assert.equal(markerMatchesUrl("/shop?category=home", "/shop?category=home"), true);
  assert.equal(markerMatchesUrl("/shop?category=gaming", "/shop?category=home"), false);
  assert.equal(markerMatchesUrl("::not a url::", "/shop"), false);
});

test("recorded markers are found by committed URL; garbage and unknown URLs fail closed", () => {
  const win: Record<string, unknown> = {};
  assert.equal(findNavigationMarker("/shop", win), null);
  recordNavigationMarker("/shop?q=lamp", "replace", win);
  assert.equal(findNavigationMarker("/shop?q=lamp", win), "replace");
  assert.equal(findNavigationMarker("/shop", win), null, "a different URL has no marker");
  // Full hrefs match committed pathname + search.
  recordNavigationMarker("https://example.com/cart", "push", win);
  assert.equal(findNavigationMarker("/cart", win), "push");
  // Tampered slot values are ignored, never thrown on.
  win[NAVIGATION_MARKER_KEY] = { url: 42, type: "evil" };
  assert.equal(findNavigationMarker("/cart", win), null);
  win[NAVIGATION_MARKER_KEY] = [{ url: "/cart", type: "evil" }, "junk", null];
  assert.equal(findNavigationMarker("/cart", win), null);
  assert.equal(findNavigationMarker("/cart", null), null);
  recordNavigationMarker("/cart", "push", null); // no window: a no-op
});

test("overlapping transitions keep every marker: a slow earlier commit still resolves (Issue 1)", () => {
  // Shop search keystrokes on a slow network: four router.replace calls start
  // before the first one commits. With a single slot the first three would be
  // overwritten and their commits would count as navigations.
  const win: Record<string, unknown> = {};
  for (const url of ["/shop?q=l", "/shop?q=la", "/shop?q=lam", "/shop?q=lamp"]) {
    recordNavigationMarker(url, "replace", win);
  }
  const tracked = simulate(
    [
      { pathname: "/shop", url: "/shop", navigationType: "initial" as const },
      ...["/shop?q=l", "/shop?q=la", "/shop?q=lam", "/shop?q=lamp"].map((url) => ({
        pathname: "/shop",
        url,
        navigationType: findNavigationMarker(url, win) ?? ("unknown" as const),
      })),
    ],
  );
  assert.deepEqual(tracked, ["/shop"], "typing never produces a page.view");
});

test("the newest marker wins for a URL recorded twice; the list is bounded", () => {
  const win: Record<string, unknown> = {};
  recordNavigationMarker("/shop?category=home", "replace", win);
  recordNavigationMarker("/shop?category=home", "push", win);
  assert.equal(findNavigationMarker("/shop?category=home", win), "push");
  for (let i = 0; i < MAX_NAVIGATION_MARKERS + 5; i += 1) {
    recordNavigationMarker(`/product/p${i}`, "push", win);
  }
  const list = win[NAVIGATION_MARKER_KEY] as unknown[];
  assert.equal(list.length, MAX_NAVIGATION_MARKERS, "oldest entries are dropped");
  assert.equal(findNavigationMarker("/shop?category=home", win), null, "evicted");
  assert.equal(findNavigationMarker(`/product/p${MAX_NAVIGATION_MARKERS + 4}`, win), "push");
});

test("a push back to the pre-refinement URL is a navigation, not a duplicate", () => {
  const tracked = simulate([
    { pathname: "/shop", url: "/shop", navigationType: "initial" },
    // Category dropdown: router.replace refinement — not a page view…
    { pathname: "/shop", url: "/shop?category=gaming", navigationType: "replace" },
    // …then the "All Products" nav link pushes /shop again: a real navigation.
    { pathname: "/shop", url: "/shop", navigationType: "push" },
    // Strict Mode re-run of that effect is still absorbed.
    { pathname: "/shop", url: "/shop", navigationType: "push" },
  ]);
  assert.deepEqual(tracked, ["/shop", "/shop"]);
});
