/**
 * Route → page title + page type — the ONE source both Next metadata and the
 * canonical page.view tracker read.
 *
 * `page.title` is the governed pageName downstream (GA4 page_title), so a
 * title is part of the analytics contract, not just presentation:
 *  - unique per ROUTE TEMPLATE (not per instance — unbounded ids in titles
 *    would explode GA4 page-report cardinality);
 *  - stable, human-readable, no query strings, no emojis, no PII;
 *  - the store PDP is the ONLY entity title ("{product name} · Aurora Market"),
 *    because product names are catalog data, not personal data.
 *
 * No URL segment ever reaches a title: dynamic routes use a fixed label.
 *
 * Runtime-agnostic (no React, no DOM, no `server-only`) so server metadata,
 * client components and the Node test runner share it.
 */

import type { PageType } from "@/lib/analytics/schema";

export const STORE_SITE_NAME = "Aurora Market";
export const ADMIN_SITE_NAME = "Aurora Market Admin";
const SEPARATOR = " · ";

export type RouteArea = "store" | "admin";

export interface RouteDefinition {
  id: string;
  /** App Router pattern; `[param]` matches exactly one path segment. */
  pattern: string;
  area: RouteArea;
  /**
   * Fixed page label, or `null` for the entity route whose title comes from
   * its data (the store PDP) — see `productPageTitle`.
   */
  label: string | null;
  page_type: PageType;
}

export const ROUTES = [
  // Store
  { id: "home", pattern: "/", area: "store", label: "Home", page_type: "home" },
  { id: "shop", pattern: "/shop", area: "store", label: "Shop", page_type: "product_list" },
  { id: "product", pattern: "/product/[id]", area: "store", label: null, page_type: "product_detail" },
  { id: "cart", pattern: "/cart", area: "store", label: "Cart", page_type: "cart" },
  { id: "checkout", pattern: "/checkout", area: "store", label: "Checkout", page_type: "checkout" },
  { id: "order_confirmation", pattern: "/order-confirmation/[id]", area: "store", label: "Order Confirmation", page_type: "order_confirmation" },
  { id: "login", pattern: "/login", area: "store", label: "Sign In", page_type: "auth_login" },
  { id: "signup", pattern: "/signup", area: "store", label: "Sign Up", page_type: "auth_signup" },
  { id: "account", pattern: "/account", area: "store", label: "My Account", page_type: "account" },
  { id: "account_orders", pattern: "/account/orders", area: "store", label: "My Orders", page_type: "account" },
  { id: "account_order_detail", pattern: "/account/orders/[id]", area: "store", label: "Order Detail", page_type: "account" },
  { id: "account_profile", pattern: "/account/profile", area: "store", label: "Profile", page_type: "account" },
  { id: "account_addresses", pattern: "/account/addresses", area: "store", label: "Addresses", page_type: "account" },
  // Admin
  { id: "admin_login", pattern: "/admin/login", area: "admin", label: "Sign In", page_type: "admin_login" },
  { id: "admin_dashboard", pattern: "/admin/dashboard", area: "admin", label: "Dashboard", page_type: "admin_dashboard" },
  { id: "admin_products", pattern: "/admin/products", area: "admin", label: "Products", page_type: "admin_product_list" },
  { id: "admin_product_detail", pattern: "/admin/products/[id]", area: "admin", label: "Product Detail", page_type: "admin_product_detail" },
  { id: "admin_orders", pattern: "/admin/orders", area: "admin", label: "Orders", page_type: "admin_order_list" },
  { id: "admin_order_detail", pattern: "/admin/orders/[id]", area: "admin", label: "Order Detail", page_type: "admin_order_detail" },
  { id: "admin_customers", pattern: "/admin/customers", area: "admin", label: "Customers", page_type: "admin_customer_list" },
  { id: "admin_customer_detail", pattern: "/admin/customers/[id]", area: "admin", label: "Customer Detail", page_type: "admin_customer_detail" },
  { id: "admin_analytics", pattern: "/admin/analytics", area: "admin", label: "Analytics", page_type: "admin_analytics" },
  { id: "admin_reports", pattern: "/admin/reports", area: "admin", label: "Reports", page_type: "admin_reports" },
  { id: "admin_activity", pattern: "/admin/activity", area: "admin", label: "Activity", page_type: "admin_activity" },
  { id: "admin_ai_assistant", pattern: "/admin/ai-assistant", area: "admin", label: "AI Assistant", page_type: "admin_ai_assistant" },
  { id: "admin_settings", pattern: "/admin/settings", area: "admin", label: "Settings", page_type: "admin_settings" },
] as const satisfies readonly RouteDefinition[];

export type RouteId = (typeof ROUTES)[number]["id"];
/** Routes whose title is fixed (everything except the entity PDP). */
export type StaticRouteId = Extract<(typeof ROUTES)[number], { label: string }>["id"];

export function formatTitle(label: string, area: RouteArea): string {
  return `${label}${SEPARATOR}${area === "admin" ? ADMIN_SITE_NAME : STORE_SITE_NAME}`;
}

export const NOT_FOUND_TITLE = formatTitle("Page Not Found", "store");
export const PRODUCT_NOT_FOUND_TITLE = formatTitle("Product Not Found", "store");

const BY_ID = new Map<string, RouteDefinition>(ROUTES.map((route) => [route.id, route]));

/** The approved title of a fixed-title route. */
export function routeTitle(id: StaticRouteId): string {
  const route = BY_ID.get(id);
  if (!route || route.label === null) throw new Error(`No fixed title for route "${id}"`);
  return formatTitle(route.label, route.area);
}

/**
 * The store PDP title. `name` is null when the product does not exist or is
 * not purchasable — the page then shows "Product not available".
 */
export function productPageTitle(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? formatTitle(trimmed, "store") : PRODUCT_NOT_FOUND_TITLE;
}

/** `{ title: { absolute } }` metadata for a fixed-title route. */
export function routeMetadata(id: StaticRouteId): { title: { absolute: string } } {
  return { title: { absolute: routeTitle(id) } };
}

/* -------------------------------------------------------------------------- */
/*  Pathname matching                                                          */
/* -------------------------------------------------------------------------- */

function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

const COMPILED = ROUTES.map((route) => ({ route, parts: segments(route.pattern) }));

/** Match an App Router pathname to its route template, or null (404). */
export function matchRoute(pathname: string): RouteDefinition | null {
  const parts = segments(pathname);
  for (const { route, parts: pattern } of COMPILED) {
    if (pattern.length !== parts.length) continue;
    if (pattern.every((p, i) => (p.startsWith("[") && p.endsWith("]")) || p === parts[i])) {
      return route;
    }
  }
  return null;
}

export interface ResolvedPageMeta {
  route: RouteDefinition | null;
  page_type: PageType;
  /**
   * The approved title, or null when it depends on page data (the PDP) and
   * must come from the page's own registration (see page-title-registry).
   */
  title: string | null;
}

/** Title + page type for a pathname, derived purely from the route table. */
export function resolvePageMeta(pathname: string): ResolvedPageMeta {
  const route = matchRoute(pathname);
  if (!route) return { route: null, page_type: "not_found", title: NOT_FOUND_TITLE };
  return {
    route,
    page_type: route.page_type,
    title: route.label === null ? null : formatTitle(route.label, route.area),
  };
}
