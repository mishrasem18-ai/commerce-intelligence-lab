/**
 * analyticsData — Aurora Market's canonical, vendor-agnostic data-layer
 * CONTRACT, formalized as the `AnalyticsData` interface below.
 *
 *   Aurora Market business interaction
 *         ↓
 *   analyticsData            (fresh AnalyticsData envelope per interaction)
 *         ↓
 *   Dispatcher               (consent gate + internal log)
 *         ↓
 *   Adapters                 (GTM → window.dataLayer → GTM → GA4,
 *                             Contentsquare, AMTA Lab)
 *
 * analyticsData is a CONTRACT, not a mutable global object: every business
 * interaction constructs a FRESH, immutable envelope conforming to this
 * schema (see `analytics.track`). There is deliberately no long-lived
 * `window.analyticsData` whose page/product/cart/user fields get overwritten
 * in place — that pattern is exactly how stale data leaks into later events.
 *
 * Events here are BUSINESS events, not vendor events. Nothing in this file may
 * reference gtag, Google Consent Mode syntax, GTM event structures, Adobe XDM,
 * eVars/props, or Contentsquare APIs — vendor naming lives only inside
 * adapters (`lib/analytics/adapters/*`). `window.dataLayer` is strictly the
 * Google/GTM adapter's OUTPUT transport; these envelopes are the source of
 * truth.
 */

import type { ConsentState, ConsentDecisionMethod } from "@/lib/analytics/consent";
import { resolvePageMeta } from "@/lib/routes/page-titles";

export type { ConsentState, ConsentDecisionMethod };

export const ANALYTICS_SCHEMA_VERSION = "1.0";

/** Storefront currency — the catalog prices everything in USD. */
export const ANALYTICS_CURRENCY = "USD";

/* -------------------------------------------------------------------------- */
/*  Contexts                                                                  */
/* -------------------------------------------------------------------------- */

export type PageType =
  | "home"
  | "product_list"
  | "product_detail"
  | "cart"
  | "checkout"
  | "order_confirmation"
  | "auth_login"
  | "auth_signup"
  | "account"
  /** Informational pages (e.g. /credits). */
  | "content"
  | "not_found"
  | "admin_login"
  | "admin_dashboard"
  | "admin_product_list"
  | "admin_product_detail"
  | "admin_order_list"
  | "admin_order_detail"
  | "admin_customer_list"
  | "admin_customer_detail"
  | "admin_analytics"
  | "admin_reports"
  | "admin_activity"
  | "admin_ai_assistant"
  | "admin_settings"
  /** Server-side / pre-hydration placeholder only; never a real route. */
  | "other";

export interface PageContext {
  /**
   * Pathname only. User-controlled segments that look like an email or phone
   * number are replaced with "[redacted]" by the PII guard.
   */
  path: string;
  /**
   * The approved page title from lib/routes/page-titles.ts — the governed
   * pageName downstream. Never read from the DOM.
   */
  title: string;
  page_type: PageType;
  /** Query string without the leading `?`, empty when none. */
  query_string: string;
}

export type AuthenticationState = "guest" | "authenticated";

/**
 * Identity context. `customer_id` is the internal non-PII customer identifier
 * (e.g. "C-AB12CD") — never an email, name or phone number.
 */
export interface UserContext {
  authentication_state: AuthenticationState;
  customer_id?: string;
}

export interface AppContext {
  name: "aurora-market";
  environment: "development" | "production" | "test";
}

/**
 * Canonical commerce item — the single reusable item representation shared by
 * every commerce event. Built from the real `Product` domain model via
 * `productToItem()` (see `lib/analytics/tracking.ts`); do not hand-roll.
 */
export interface CommerceItem {
  product_id: string;
  sku: string;
  name: string;
  brand: string;
  /** Display label, e.g. "Gaming". */
  category: string;
  /** Canonical category slug (D1 `categories.id`). */
  category_id: string;
  price: number;
  quantity: number;
  currency: string;
  variant?: string;
  list_name?: string;
  list_position?: number;
}

export interface CommerceContext {
  currency: string;
  /** Monetary value of the event (line value, cart value, order total…). */
  value?: number;
  items?: CommerceItem[];
  list_name?: string;
  /** Public order number (e.g. "AM-1024") — an order id is not PII. */
  order_id?: string;
  tax?: number;
  shipping?: number;
  payment_method?: string;
  item_count?: number;
  checkout_step?: "begin" | "shipping" | "payment";
}

/** Where a deliberate search came from (see lib/analytics/search.ts). */
export type SearchSource = "header" | "shop" | "suggestion" | "url";

export interface SearchContext {
  /** Normalised term (trimmed, collapsed, lower-case); "[redacted]" if PII. */
  query: string;
  results_count: number;
  search_source: SearchSource;
  zero_results: boolean;
}

export interface ConsentChangeContext {
  method: ConsentDecisionMethod;
  categories: ConsentState;
}

/* -------------------------------------------------------------------------- */
/*  Event names & per-event payloads                                          */
/* -------------------------------------------------------------------------- */

/**
 * Per-event payload contract. Commerce events REQUIRE a commerce context,
 * search requires a search context, consent.update requires the decision —
 * enforced at compile time through `analytics.track()`.
 */
export type EventPayloadMap = {
  "page.view": { page?: Partial<PageContext> };
  "commerce.view_item_list": { commerce: CommerceContext };
  "commerce.select_item": { commerce: CommerceContext };
  "commerce.view_item": { commerce: CommerceContext };
  "commerce.add_to_cart": { commerce: CommerceContext };
  "commerce.remove_from_cart": { commerce: CommerceContext };
  "commerce.view_cart": { commerce: CommerceContext };
  "commerce.begin_checkout": { commerce: CommerceContext };
  "commerce.add_shipping_info": { commerce: CommerceContext };
  "commerce.add_payment_info": { commerce: CommerceContext };
  "commerce.purchase": { commerce: CommerceContext };
  "user.sign_up": Record<string, never>;
  "user.login": Record<string, never>;
  "user.logout": Record<string, never>;
  "search.submit": { search: SearchContext };
  "consent.banner_view": Record<string, never>;
  "consent.update": { consent_change: ConsentChangeContext };
};

export type AnalyticsEventName = keyof EventPayloadMap;

export const ANALYTICS_EVENT_NAMES = [
  "page.view",
  "commerce.view_item_list",
  "commerce.select_item",
  "commerce.view_item",
  "commerce.add_to_cart",
  "commerce.remove_from_cart",
  "commerce.view_cart",
  "commerce.begin_checkout",
  "commerce.add_shipping_info",
  "commerce.add_payment_info",
  "commerce.purchase",
  "user.sign_up",
  "user.login",
  "user.logout",
  "search.submit",
  "consent.banner_view",
  "consent.update",
] as const satisfies readonly AnalyticsEventName[];

/* -------------------------------------------------------------------------- */
/*  Envelope                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The analyticsData contract: the common envelope every canonical event ships
 * in. One fresh instance is created per business interaction. Adapters
 * receive exactly this shape (already PII-scrubbed) and translate it to
 * their vendor format — GA4 names, Consent Mode signals, Adobe-style
 * educational structures etc. never appear in here.
 */
export interface AnalyticsData<
  N extends AnalyticsEventName = AnalyticsEventName,
> {
  event_name: N;
  event_id: string;
  /** ISO-8601. */
  timestamp: string;
  schema_version: string;
  page: PageContext;
  user: UserContext;
  consent: ConsentState;
  app: AppContext;
  commerce?: CommerceContext;
  search?: SearchContext;
  consent_change?: ConsentChangeContext;
}

/* -------------------------------------------------------------------------- */
/*  Page-type derivation                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Derive the canonical page type from an App Router pathname. Delegates to
 * the shared route table so page types and titles can never drift apart;
 * unmatched paths are the 404 page.
 */
export function pageTypeFromPath(pathname: string): PageType {
  return resolvePageMeta(pathname).page_type;
}
