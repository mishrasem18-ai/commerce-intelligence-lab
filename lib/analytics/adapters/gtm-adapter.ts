/**
 * Google Tag Manager adapter — PLACEHOLDER (Phase 2).
 *
 * No container ID is configured and no script is loaded; `isConfigured()` is
 * false, so the dispatcher records "not_configured" for every event. The
 * canonical→dataLayer mapping below exists so Phase 2 only has to supply a
 * container ID: `window.dataLayer` remains a per-vendor OUTPUT of the
 * canonical layer, never the source of truth.
 */

import type { AnalyticsAdapter } from "@/lib/analytics/adapters/types";
import type { AnalyticsEvent, AnalyticsEventName } from "@/lib/analytics/schema";

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
 * Pure mapping from a canonical envelope to the shape a future GTM adapter
 * would push into `window.dataLayer`. Exported for tests/documentation; not
 * dispatched anywhere until a container is configured in Phase 2.
 */
export function mapEventToDataLayer(event: AnalyticsEvent): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    event: GA4_EVENT_NAME_MAP[event.event_name] ?? event.event_name,
    event_id: event.event_id,
    page_type: event.page.page_type,
  };
  if (event.commerce) {
    payload.ecommerce = {
      currency: event.commerce.currency,
      value: event.commerce.value,
      transaction_id: event.commerce.order_id,
      tax: event.commerce.tax,
      shipping: event.commerce.shipping,
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
    };
  }
  if (event.search) payload.search_term = event.search.query;
  return payload;
}

export function createGtmAdapter(): AnalyticsAdapter {
  return {
    name: "gtm",
    label: "Google Tag Manager",
    consentCategory: "analytics",
    // Phase 2: return true once a real container ID is provided.
    isConfigured: () => false,
    track: () => {
      // Phase 2: window.dataLayer.push(mapEventToDataLayer(event))
      // Unreachable today — the dispatcher short-circuits unconfigured
      // adapters to "not_configured" before calling track().
    },
  };
}
