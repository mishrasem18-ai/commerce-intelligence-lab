/**
 * Page-title governance: page.title is the pageName downstream (GA4
 * page_title), so titles are part of the analytics contract.
 * Run: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  ADMIN_SITE_NAME,
  NOT_FOUND_TITLE,
  PRODUCT_NOT_FOUND_TITLE,
  ROUTES,
  STORE_SITE_NAME,
  matchRoute,
  productPageTitle,
  resolvePageMeta,
  routeTitle,
  type StaticRouteId,
} from "./page-titles.ts";
import { containsContactDetails } from "../analytics/pii.ts";
import { pageTypeFromPath } from "../analytics/schema.ts";

const staticRoutes = ROUTES.filter((r) => r.label !== null);
const allTitles = [
  ...staticRoutes.map((r) => routeTitle(r.id as StaticRouteId)),
  NOT_FOUND_TITLE,
  PRODUCT_NOT_FOUND_TITLE,
];

/** The approved Gate-1 table — changing a title is a governed change. */
const APPROVED: Record<string, string> = {
  "/": "Home · Aurora Market",
  "/shop": "Shop · Aurora Market",
  "/cart": "Cart · Aurora Market",
  "/checkout": "Checkout · Aurora Market",
  "/order-confirmation/[id]": "Order Confirmation · Aurora Market",
  "/login": "Sign In · Aurora Market",
  "/signup": "Sign Up · Aurora Market",
  "/account": "My Account · Aurora Market",
  "/account/orders": "My Orders · Aurora Market",
  "/account/orders/[id]": "Order Detail · Aurora Market",
  "/account/profile": "Profile · Aurora Market",
  "/account/addresses": "Addresses · Aurora Market",
  "/credits": "Image Credits · Aurora Market",
  "/admin/login": "Sign In · Aurora Market Admin",
  "/admin/dashboard": "Dashboard · Aurora Market Admin",
  "/admin/products": "Products · Aurora Market Admin",
  "/admin/products/[id]": "Product Detail · Aurora Market Admin",
  "/admin/orders": "Orders · Aurora Market Admin",
  "/admin/orders/[id]": "Order Detail · Aurora Market Admin",
  "/admin/customers": "Customers · Aurora Market Admin",
  "/admin/customers/[id]": "Customer Detail · Aurora Market Admin",
  "/admin/analytics": "Analytics · Aurora Market Admin",
  "/admin/reports": "Reports · Aurora Market Admin",
  "/admin/activity": "Activity · Aurora Market Admin",
  "/admin/ai-assistant": "AI Assistant · Aurora Market Admin",
  "/admin/settings": "Settings · Aurora Market Admin",
};

test("every fixed title matches the approved table", () => {
  for (const route of staticRoutes) {
    assert.equal(routeTitle(route.id as StaticRouteId), APPROVED[route.pattern], route.pattern);
  }
  assert.equal(NOT_FOUND_TITLE, "Page Not Found · Aurora Market");
  assert.equal(PRODUCT_NOT_FOUND_TITLE, "Product Not Found · Aurora Market");
  assert.equal(productPageTitle("Halo Desk Lamp"), "Halo Desk Lamp · Aurora Market");
  assert.equal(productPageTitle(null), PRODUCT_NOT_FOUND_TITLE);
  assert.equal(productPageTitle("  "), PRODUCT_NOT_FOUND_TITLE);
});

test("every route template has a unique title", () => {
  assert.equal(new Set(allTitles).size, allTitles.length, `duplicate titles: ${allTitles}`);
  // Entity PDP titles can't collide with fixed ones: product names never end
  // in a fixed label, and admin titles carry a different site name.
  assert.equal(new Set(ROUTES.map((r) => r.pattern)).size, ROUTES.length);
  assert.equal(new Set(ROUTES.map((r) => r.id)).size, ROUTES.length);
});

test("titles follow the deliberate suffix convention", () => {
  for (const route of staticRoutes) {
    const title = routeTitle(route.id as StaticRouteId);
    const suffix = route.area === "admin" ? ADMIN_SITE_NAME : STORE_SITE_NAME;
    assert.ok(title.endsWith(` · ${suffix}`), title);
    assert.equal(title.split(" · ").length, 2, title);
  }
});

test("no title contains PII, query strings, ids, emojis or URL fragments", () => {
  for (const title of allTitles) {
    assert.equal(containsContactDetails(title), false, title);
    assert.doesNotMatch(title, /[?&=#/@]/, title);
    assert.doesNotMatch(title, /\p{Extended_Pictographic}/u, title);
    assert.doesNotMatch(title, /\b(ORD-|C-\d|prod-)/i, title);
  }
  // Dynamic segments never reach a title.
  for (const route of ROUTES.filter((r) => r.pattern.includes("["))) {
    assert.ok(route.label === null || !/\[/.test(route.label));
  }
});

test("routes resolve by template; unmatched paths are the 404 page", () => {
  assert.equal(matchRoute("/product/prod-1000")?.id, "product");
  assert.equal(matchRoute("/admin/customers/C-2201")?.id, "admin_customer_detail");
  assert.equal(matchRoute("/account/orders/ORD-1A2B3C4")?.id, "account_order_detail");
  assert.equal(matchRoute("/shop/")?.id, "shop");
  assert.equal(matchRoute("/product/a/b"), null);
  assert.equal(matchRoute("/nope"), null);

  const missing = resolvePageMeta("/does-not-exist");
  assert.deepEqual([missing.page_type, missing.title], ["not_found", NOT_FOUND_TITLE]);
  // The PDP title is data-dependent: resolved by registration, not the table.
  assert.equal(resolvePageMeta("/product/prod-1000").title, null);
  assert.equal(
    resolvePageMeta("/account/orders/jane@example.com").title,
    "Order Detail · Aurora Market",
  );
});

test("pageTypeFromPath covers store, admin and 404 from the same table", () => {
  const cases: Record<string, string> = {
    "/": "home",
    "/shop": "product_list",
    "/product/prod-1001": "product_detail",
    "/cart": "cart",
    "/checkout": "checkout",
    "/order-confirmation/ORD-1042": "order_confirmation",
    "/login": "auth_login",
    "/signup": "auth_signup",
    "/account": "account",
    "/account/orders/ORD-1": "account",
    "/credits": "content",
    "/admin/login": "admin_login",
    "/admin/dashboard": "admin_dashboard",
    "/admin/products": "admin_product_list",
    "/admin/products/prod-1": "admin_product_detail",
    "/admin/orders": "admin_order_list",
    "/admin/orders/ORD-1": "admin_order_detail",
    "/admin/customers": "admin_customer_list",
    "/admin/customers/C-1": "admin_customer_detail",
    "/admin/analytics": "admin_analytics",
    "/admin/reports": "admin_reports",
    "/admin/activity": "admin_activity",
    "/admin/ai-assistant": "admin_ai_assistant",
    "/admin/settings": "admin_settings",
    "/missing": "not_found",
  };
  for (const [path, type] of Object.entries(cases)) {
    assert.equal(pageTypeFromPath(path), type, path);
  }
});

/* -------------------------------------------------------------------------- */
/*  Inventory: the table covers every page in app/, and pages use it          */
/* -------------------------------------------------------------------------- */

const APP_DIR = new URL("../../app/", import.meta.url).pathname;

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return pageFiles(full);
    return entry === "page.tsx" ? [full] : [];
  });
}

/** app/(store)/product/[id]/page.tsx → /product/[id] */
function patternOf(file: string): string {
  const segs = relative(APP_DIR, file)
    .split("/")
    .slice(0, -1)
    .filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return `/${segs.join("/")}`;
}

// Server-side redirect only (never renders, never tracked).
const REDIRECT_ONLY = new Set(["/admin"]);

test("every app/ page has exactly one route-table entry", () => {
  const patterns = pageFiles(APP_DIR).map(patternOf).filter((p) => !REDIRECT_ONLY.has(p));
  const table = new Set<string>(ROUTES.map((r) => r.pattern));
  for (const pattern of patterns) assert.ok(table.has(pattern), `no title for ${pattern}`);
  for (const pattern of table) assert.ok(patterns.includes(pattern), `stale route ${pattern}`);
});

test("pages take their titles from the route table, never hand-written", () => {
  for (const file of pageFiles(APP_DIR)) {
    const pattern = patternOf(file);
    if (REDIRECT_ONLY.has(pattern)) continue;
    const source = readFileSync(file, "utf8");
    assert.match(
      source,
      /routeMetadata\(|productPageTitle\(/,
      `${pattern} must use routeMetadata()/productPageTitle()`,
    );
    assert.doesNotMatch(source, /title:\s*["'`]/, `${pattern} hand-writes a title`);
  }
});
