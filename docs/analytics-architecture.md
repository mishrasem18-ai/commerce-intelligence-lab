# Aurora Market — Analytics Architecture (Phase 1)

Aurora Market doubles as a **digital analytics training lab**. Its measurement
architecture is deliberately **vendor-agnostic**: business interactions produce
canonical events, and vendor tools are pluggable destinations.

```
Aurora Market business interaction  (Add to Cart, Search, Purchase…)
        ↓
Canonical Analytics Layer           analytics.track("commerce.add_to_cart", …)
        ↓                           lib/analytics/analytics.ts (envelope + PII scrub)
Consent Gate / Dispatcher           lib/analytics/dispatcher.ts
        ↓                           (internal log always; vendors only with consent)
Adapters                            lib/analytics/adapters/*
   ├── GTM Adapter          (Phase 2 — placeholder, not configured)
   ├── Contentsquare Adapter (Phase 2 — placeholder, not configured)
   └── AMTA Lab Adapter      (Phase 2 — placeholder, not configured)
```

## Why canonical events are vendor-neutral

Business components never call `window.dataLayer.push`, `gtag`, Contentsquare,
Adobe or AMTA APIs. They call exactly one API:

```ts
import { analytics } from "@/lib/analytics";

analytics.track("commerce.add_to_cart", { commerce: productCommerce(product) });
```

Benefits:

- **One source of truth.** The canonical envelope (below) is the record of what
  happened. Vendor payloads are derived views, generated inside adapters.
- **Swap/add destinations without touching UI code.** Adding GA4 or AMTA Lab in
  Phase 2 means registering an adapter — checkout code doesn't change.
- **Teachable.** Learners can watch the exact pipeline
  interaction → canonical event → consent decision → adapter → destination in
  the built-in Analytics Debugger.

### Why `window.dataLayer` is NOT the source of truth

`window.dataLayer` is Google Tag Manager's ingestion queue — a **vendor
transport**, shaped by GA4's naming (`add_to_cart`, `items[].item_id`…). If
components pushed to it directly, every other destination would have to parse
Google's format, GTM's schema would leak into business code, and turning GTM
off would silence all measurement. Here the future GTM adapter will *translate*
canonical events into dataLayer pushes; the dataLayer is an output, never the
model.

## The canonical event envelope

Defined in `lib/analytics/schema.ts` (schema_version `1.0`):

```jsonc
{
  "event_name": "commerce.add_to_cart",
  "event_id": "9f1c…",                    // unique per event
  "timestamp": "2026-07-26T10:00:00.000Z",
  "schema_version": "1.0",
  "page":    { "path": "/shop", "title": "Shop · Aurora Market",
               "page_type": "product_list", "query_string": "category=gaming" },
  "user":    { "authentication_state": "authenticated", "customer_id": "C-AB12CD" },
  "consent": { "necessary": true, "analytics": false,
               "advertising": false, "personalization": false },
  "app":     { "name": "aurora-market", "environment": "development" },
  "commerce": {                            // present on commerce.* events
    "currency": "USD", "value": 49.99,
    "items": [{ "product_id": "prod-1001", "sku": "HLO-DL-1001",
                "name": "Halo Desk Lamp", "brand": "Halo",
                "category": "Home", "category_id": "home",
                "price": 49.99, "quantity": 1, "currency": "USD" }]
  }
}
```

Event names use a `namespace.verb` convention: `page.view`,
`commerce.view_item_list`, `commerce.select_item`, `commerce.view_item`,
`commerce.add_to_cart`, `commerce.remove_from_cart`, `commerce.view_cart`,
`commerce.begin_checkout`, `commerce.add_shipping_info`,
`commerce.add_payment_info`, `commerce.purchase`, `user.sign_up`, `user.login`,
`user.logout`, `search.submit`, `consent.banner_view`, `consent.update`.

## PII rules

Canonical payloads must never contain direct PII (email, name, phone, address,
passwords, tokens, cookies, hashes, raw D1 records). Enforcement is layered:

1. **Mappers only expose safe fields** — `productToItem`/`orderCommerce`
   (`lib/analytics/tracking.ts`) map the domain models onto whitelisted
   commercial fields; an order's email/name/address are simply never read.
2. **Identity is pseudonymous** — the user context carries only
   `authentication_state` and the internal `customer_id`; `setUserContext`
   drops any other field.
3. **A PII guard scrubs every envelope** (`lib/analytics/pii.ts`): forbidden
   key names (email, password, token, cookie, address…) and email-shaped
   string values are replaced with `"[redacted]"` before dispatch, and
   violations are flagged in the debugger + a dev console warning.

## Consent architecture

`lib/analytics/consent.ts` — vendor-neutral model with four categories:
`necessary` (always `true`, structurally unremovable), `analytics`,
`advertising`, `personalization`.

- **Default:** everything except necessary is OFF until the user decides.
- **Persistence:** localStorage (`aurora.consent.v1`) — no D1 involvement.
- **UI:** first-visit banner (Accept All / Reject All / Manage Preferences) and
  a preferences dialog, reachable any time via the footer **Cookie Settings**
  link (`components/analytics/consent-manager.tsx`).
- **Propagation:** the store is observable; the dispatcher reads the live
  state on every dispatch, so a consent change applies to the very next event.
- **No circularity:** `consent.banner_view`/`consent.update` flow through the
  same pipeline and are always visible in the *internal* log, even while all
  vendor adapters are blocked. Google Consent Mode / Adobe consent APIs are
  deliberately absent — those mappings belong inside Phase 2 adapters.

## Dispatcher & adapter contract

`lib/analytics/dispatcher.ts` fans each canonical event out to registered
adapters and records an honest per-destination status:

- `delivered` — adapter is configured, consent granted, `track()` succeeded
- `blocked_by_consent` — configured but the required category is denied
- `not_configured` — placeholder destination (all of Phase 1)
- `error` — the adapter threw; the error is contained

Failure isolation: `dispatch` never throws, each adapter call is individually
try/caught, and a failing consent read fails **closed** (no vendor dispatch).
Analytics can never break add-to-cart, checkout or navigation.

Adapters implement (`lib/analytics/adapters/types.ts`):

```ts
interface AnalyticsAdapter {
  name: string;
  label: string;
  consentCategory: ConsentCategory;  // gate applied by the dispatcher
  isConfigured(): boolean;
  initialize?(): void;
  track(event: AnalyticsEvent): void;
  destroy?(): void;
}
```

## Future destination mapping (Phase 2 — nothing installed yet)

**GTM / GA4** (`adapters/gtm-adapter.ts`): already contains the pure mapper
`mapEventToDataLayer`. When a container ID is supplied, the adapter will do:

```ts
// canonical                            // GTM adapter output
"commerce.add_to_cart"          →       window.dataLayer.push({
  commerce.items[0].product_id  →         event: "add_to_cart",
                                          ecommerce: { currency, value,
                                            items: [{ item_id, item_name,
                                                      item_brand, price, quantity }] }
                                        })
```

GA4 naming lives only in `GA4_EVENT_NAME_MAP` — never in components.

**Contentsquare** (`adapters/contentsquare-adapter.ts`): Phase 2 loads the tag
and maps envelopes to Contentsquare variables. Until then `isConfigured()` is
false.

**AMTA Lab** (`adapters/amta-adapter.ts`): AMTA Lab is the author's **own
educational platform** that simulates Adobe-style analytics concepts for
training. It is **not Adobe software** — no Adobe Analytics, Launch, AEP, Web
SDK, Target, CJA or AJO is (or will be) integrated into Aurora Market. The
adapter will deliver canonical envelopes over a transport chosen later (HTTP
collector, SDK, or tag-manager-style); the canonical schema is transport- and
vendor-independent, so AMTA can map the same business events onto its
educational Adobe-style concepts without any change to storefront code.

## Analytics Debugger

`components/analytics/analytics-debugger.tsx` — toggled from the footer
("Analytics Debugger"). Shows, per event: timestamp, canonical name, event id,
page type, the full scrubbed envelope, the consent snapshot, and per-adapter
status (GTM / Contentsquare / AMTA Lab all honestly report **Not configured**
in Phase 1). It renders only post-scrub envelopes from the dispatcher log, so
passwords, cookies, tokens and PII can never appear.

## Instrumentation map

| Journey | Event | Where |
| --- | --- | --- |
| Any route change | `page.view` | `components/analytics/page-view-tracker.tsx` (store layout, Suspense-wrapped, URL-deduped) |
| Shop grid | `commerce.view_item_list` | `shop-view.tsx` (debounced, signature-deduped) |
| Search | `search.submit` | `shop-view.tsx` (settled query + result count) |
| Card click | `commerce.select_item` | `buyer-product-card.tsx` |
| Product page | `commerce.view_item` | `buyer-product-detail.tsx` (per-product dedupe) |
| Add to cart | `commerce.add_to_cart` | product card + product detail (incl. Buy Now) |
| Remove line | `commerce.remove_from_cart` | `cart-view.tsx` |
| Cart page | `commerce.view_cart` | `cart-view.tsx` (once per visit) |
| Checkout reached | `commerce.begin_checkout` | `checkout-view.tsx` (signed-in + items, once) |
| Address complete | `commerce.add_shipping_info` | `checkout-view.tsx` (address itself never tracked) |
| Payment chosen | `commerce.add_payment_info` | `checkout-view.tsx` (method only) |
| Order created | `commerce.purchase` | `checkout-view.tsx` — fires **only** in the successful `/api/orders` response branch, deduped by order id (never on page load, failure, re-render or refresh) |
| Signup/Login/Logout | `user.sign_up` / `user.login` / `user.logout` | `lib/store/auth-store.tsx` (identity = internal customer id only) |
| Consent | `consent.banner_view` / `consent.update` | `consent-manager.tsx` / `analytics.updateConsent` |

## Phase 1 boundaries

No GTM container, GA4 Measurement ID, Contentsquare script, Adobe SDK or AMTA
endpoint is configured. No vendor network requests are made or simulated. The
placeholder adapters exist so Phase 2 is a registration + configuration task,
not a re-architecture.
