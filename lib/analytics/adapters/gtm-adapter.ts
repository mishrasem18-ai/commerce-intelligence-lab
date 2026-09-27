/**
 * Google Tag Manager adapter (Phase 2A).
 *
 * The canonical vendor-agnostic layer remains the source of truth; this
 * adapter is one OUTPUT of it. Everything Google-specific — the container
 * script, `window.dataLayer`, GA4 event naming, Google Consent Mode — lives
 * in this file and nowhere else in the application.
 *
 * Activation is environment-driven: the adapter stays "not_configured" (the
 * Phase 1 behaviour — no script, no dataLayer, no network traffic) until
 * `NEXT_PUBLIC_GTM_CONTAINER_ID` is set to a `GTM-XXXXXXX` container ID.
 * No real container ID is configured in this repository.
 *
 * Consent integration (when configured):
 *  - `initialize()` pushes a Consent Mode DEFAULT with every signal denied
 *    (except the always-on security/functionality signals) BEFORE the
 *    container script is injected.
 *  - `onConsentChange()` translates the neutral consent state into a Consent
 *    Mode UPDATE. The dispatcher invokes it on startup and on every change,
 *    including "denied" — that is the whole point of Consent Mode.
 *  - Event delivery stays separately gated by the dispatcher: `track()` is
 *    never called without the `analytics` consent category granted.
 */

import type { AnalyticsAdapter } from "@/lib/analytics/adapters/types";
import type { AnalyticsData, AnalyticsEventName } from "@/lib/analytics/schema";
import type { ConsentState } from "@/lib/analytics/consent";
import { redactUrl } from "@/lib/analytics/pii";

/**
 * Canonical → GA4-recommended event naming. Lives HERE, not in application
 * components — business code never knows GA4 names exist.
 */
export const GA4_EVENT_NAME_MAP: Partial<Record<AnalyticsEventName, string>> = {
  "page.view": "page_view",
  "commerce.view_item_list": "view_item_list",
  "commerce.select_item": "select_item",
  "commerce.view_item": "view_item",
  "commerce.add_to_cart": "add_to_cart",
  "commerce.remove_from_cart": "remove_from_cart",
  "commerce.view_cart": "view_cart",
  "commerce.begin_checkout": "begin_checkout",
  "commerce.add_shipping_info": "add_shipping_info",
  "commerce.add_payment_info": "add_payment_info",
  "commerce.purchase": "purchase",
  "user.sign_up": "sign_up",
  "user.login": "login",
  "search.submit": "search",
};

/**
 * Pure mapping from a canonical envelope to the object pushed into
 * `window.dataLayer`. Exported for tests and documentation.
 *
 * `page_location` is rebuilt from the PII-scrubbed canonical path + query
 * string, and `page_referrer` (supplied by the adapter) is likewise
 * scrubbed. GA4 tags must read both from the dataLayer (see
 * docs/ga4-gtm-changes.md) instead of the Google tag's defaults
 * (`document.location.href` / `document.referrer`), which would carry an
 * email typed into the URL.
 *
 * Every push carries the same top-level keys. GTM merges each push into one
 * data model that lasts for the whole page (in-app navigation and sign-out
 * don't reload it), so an omitted key would keep its last value. A key the
 * event doesn't carry is therefore pushed as `undefined`, which GTM treats as
 * "clear this key": `customer_id` after sign-out, the `search_*` keys after a
 * search, `page_referrer` when there is none, `ecommerce` on non-commerce
 * events.
 */
export function mapEventToDataLayer(
  event: AnalyticsData,
  options: { origin?: string; referrer?: string | null } = {},
): Record<string, unknown> {
  const query = event.page.query_string ? `?${event.page.query_string}` : "";
  return {
    event: GA4_EVENT_NAME_MAP[event.event_name] ?? event.event_name,
    event_id: event.event_id,
    page_type: event.page.page_type,
    page_path: event.page.path,
    page_title: event.page.title,
    page_location: options.origin ? `${options.origin}${event.page.path}${query}` : undefined,
    page_referrer: options.referrer || undefined,
    customer_id: event.user.customer_id || undefined,
    ecommerce: event.commerce
      ? {
          currency: event.commerce.currency,
          value: event.commerce.value,
          transaction_id: event.commerce.order_id,
          tax: event.commerce.tax,
          shipping: event.commerce.shipping,
          payment_type: event.commerce.payment_method,
          item_list_name: event.commerce.list_name,
          items: event.commerce.items?.map((item) => ({
            item_id: item.product_id,
            item_name: item.name,
            item_brand: item.brand,
            item_category: item.category,
            item_variant: item.variant,
            item_list_name: item.list_name,
            index: item.list_position,
            price: item.price,
            quantity: item.quantity,
          })),
        }
      : undefined,
    search_term: event.search?.query,
    search_results_count: event.search?.results_count,
    search_source: event.search?.search_source,
    search_zero_results: event.search?.zero_results,
  };
}

/**
 * Neutral consent state → Google Consent Mode signals. `advertising` drives
 * the three ad signals, `analytics` drives analytics_storage,
 * `personalization` drives personalization_storage; security/functionality
 * mirror the always-on "necessary" category.
 */
export function consentToGoogleConsentMode(
  state: ConsentState,
): Record<string, "granted" | "denied"> {
  const signal = (granted: boolean) => (granted ? "granted" : "denied");
  return {
    ad_storage: signal(state.advertising),
    ad_user_data: signal(state.advertising),
    ad_personalization: signal(state.advertising),
    analytics_storage: signal(state.analytics),
    personalization_storage: signal(state.personalization),
    functionality_storage: "granted",
    security_storage: "granted",
  };
}

/** Consent Mode DEFAULT pushed before the container loads: everything denied. */
export const CONSENT_MODE_DEFAULT: Record<string, "granted" | "denied"> = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  personalization_storage: "denied",
  functionality_storage: "granted",
  security_storage: "granted",
};

const CONTAINER_ID_PATTERN = /^GTM-[A-Z0-9]{4,}$/;

export function isValidContainerId(id: string | undefined): id is string {
  return typeof id === "string" && CONTAINER_ID_PATTERN.test(id);
}

/** The minimal window surface the adapter touches — injectable for tests. */
export interface GtmWindow {
  dataLayer?: unknown[];
  location?: { origin: string };
  document?: { referrer: string };
}

export interface GtmAdapterOptions {
  /** Defaults to NEXT_PUBLIC_GTM_CONTAINER_ID (unset in this repo). */
  containerId?: string;
  /** Window seam for tests; defaults to the real `window` (null on server). */
  win?: GtmWindow | null;
  /** Script-injection seam for tests; defaults to a real <script> tag. */
  injectScript?: (containerId: string) => void;
}

const SCRIPT_ELEMENT_ID = "aurora-gtm-script";

function defaultWindow(): GtmWindow | null {
  return typeof window === "undefined" ? null : (window as GtmWindow);
}

function defaultInjectScript(containerId: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(SCRIPT_ELEMENT_ID)) return; // never load twice
  const script = document.createElement("script");
  script.id = SCRIPT_ELEMENT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  document.head.appendChild(script);
}

export function createGtmAdapter(options: GtmAdapterOptions = {}): AnalyticsAdapter {
  const containerId = options.containerId ?? process.env.NEXT_PUBLIC_GTM_CONTAINER_ID;
  const win = options.win !== undefined ? options.win : defaultWindow();
  const injectScript = options.injectScript ?? defaultInjectScript;
  let initialized = false;
  let lastPageLocation: string | null = null;
  let referrer: string | null = null;

  const dataLayer = (): unknown[] | null => {
    if (!win) return null;
    win.dataLayer = win.dataLayer ?? [];
    return win.dataLayer;
  };

  /**
   * Google's `function gtag(){dataLayer.push(arguments)}`, verbatim: gtag.js
   * expects an Arguments object, so the typed rest parameter exists only for
   * call-site type-checking.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function gtag(..._args: unknown[]): void {
    // eslint-disable-next-line prefer-rest-params
    dataLayer()?.push(arguments);
  }

  return {
    name: "gtm",
    label: "Google Tag Manager",
    consentCategory: "analytics",

    isConfigured: () => isValidContainerId(containerId) && win !== null,

    initialize() {
      if (initialized || !isValidContainerId(containerId)) return;
      const dl = dataLayer();
      if (!dl) return;
      initialized = true;
      // Consent Mode default MUST precede the container script.
      gtag("consent", "default", { ...CONSENT_MODE_DEFAULT });
      dl.push({ "gtm.start": Date.now(), event: "gtm.js" });
      injectScript(containerId);
    },

    track(event) {
      const dl = dataLayer();
      if (!dl) return;
      const origin = win?.location?.origin;
      // page_referrer for a single-page app: the previous page view's
      // (scrubbed) page_location; for the document's first page view, the
      // browser referrer, scrubbed the same way. Every event carries the
      // referrer of the page it happened on.
      if (event.event_name === "page.view") {
        referrer =
          lastPageLocation ?? (win?.document?.referrer ? redactUrl(win.document.referrer) : null);
      }
      // GA4 guidance: clear the previous ecommerce object so stale items
      // can't merge into the next event.
      if (event.commerce) dl.push({ ecommerce: null });
      const payload = mapEventToDataLayer(event, { origin, referrer });
      if (event.event_name === "page.view" && typeof payload.page_location === "string") {
        lastPageLocation = payload.page_location;
      }
      dl.push(payload);
    },

    describe(event) {
      return `mapped to "${GA4_EVENT_NAME_MAP[event.event_name] ?? event.event_name}" on window.dataLayer`;
    },

    onConsentChange(state) {
      if (!initialized) return;
      gtag("consent", "update", consentToGoogleConsentMode(state));
    },

    destroy() {
      initialized = false;
      if (typeof document !== "undefined") {
        document.getElementById(SCRIPT_ELEMENT_ID)?.remove();
      }
    },
  };
}
