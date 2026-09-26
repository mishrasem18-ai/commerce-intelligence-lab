/**
 * Logical-navigation identity tests: exactly one canonical page.view per
 * committed logical navigation, decided deterministically (no timing).
 * Run: npm run test:analytics
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decidePageView,
  locationAfter,
  markerMatchesUrl,
  NAVIGATION_MARKER_KEY,
  readNavigationMarker,
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

test("readNavigationMarker validates shape and rejects tampered values", () => {
  const win: Record<string, unknown> = {};
  assert.equal(readNavigationMarker(win), null);
  win[NAVIGATION_MARKER_KEY] = { url: "/shop", type: "replace" };
  assert.deepEqual(readNavigationMarker(win), { url: "/shop", type: "replace" });
  win[NAVIGATION_MARKER_KEY] = { url: 42, type: "evil" };
  assert.equal(readNavigationMarker(win), null);
  assert.equal(readNavigationMarker(null), null);
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
