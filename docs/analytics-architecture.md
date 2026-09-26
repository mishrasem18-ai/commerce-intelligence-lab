# Aurora Market — Analytics Architecture

Aurora Market doubles as a **digital analytics training lab**. Its measurement
architecture is deliberately **vendor-agnostic**: business interactions produce
canonical **analyticsData** events, and vendor tools are pluggable
destinations.

```
Aurora Market business interaction  (Add to Cart, Search, Purchase…)
        ↓
analyticsData                       analytics.track("commerce.add_to_cart", …)
(canonical vendor-agnostic          → one FRESH AnalyticsData envelope
 data layer)                          lib/analytics/schema.ts + analytics.ts
        ↓
Consent Gate / Dispatcher           lib/analytics/dispatcher.ts
        ↓                           (internal log always; vendors only with consent)
Adapters                            lib/analytics/adapters/*
   ├── GTM Adapter ──→ window.dataLayer ──→ GTM container ──→ GA4
   ├── Contentsquare Adapter   (future — not configured)
   └── AMTA Lab Adapter        (future — not configured)
                └──→ the author's OWN Adobe-style educational tools
                     (NOT actual Adobe software)
```

## What is analyticsData?

**analyticsData is Aurora Market's canonical, vendor-agnostic data-layer
contract**, formalized as the `AnalyticsData` TypeScript interface in
`lib/analytics/schema.ts`. It is the authoritative record of what happened in
the business domain — pages, products, cart, checkout, identity state, consent
state — expressed in neutral terms that no vendor owns.

**It is a contract producing fresh envelopes, not a mutable global object.**
Every business interaction constructs a new, immutable `AnalyticsData`
envelope via `analytics.track()`. There is deliberately no long-lived
`window.analyticsData` whose `page`/`product`/`cart`/`user` slots get
overwritten in place: that classic pattern is exactly how stale product data
ends up attached to a later purchase, or a previous user's identity leaks into
the next session's events. Freshness-per-event is enforced by construction and
by tests (`analytics-data-contract.test.ts`).

analyticsData must never contain vendor structures — no `gtag` calls, no
Google Consent Mode signal names, no GTM event shapes, no Adobe XDM/eVars/
props, no Contentsquare APIs. Those translations live exclusively inside
adapters/mappers, one step downstream.

### `window.analyticsData` — the DevTools inspector

Because this is a training lab, the canonical layer is inspectable from the
browser console: typing `window.analyticsData` returns a **read-only,
deep-frozen snapshot** (`lib/analytics/inspector.ts`) containing the recent
scrubbed `AnalyticsData` envelopes, the neutral consent state, the non-PII
user context and destination metadata. It is a getter that builds a fresh
copy on every access — assignments are rejected and the returned object is
immutable, so DevTools users can inspect but never mutate canonical state.
It is NOT `window.dataLayer` and never aliases it; the two can be compared
side-by-side in DevTools to see canonical vs. Google-mapped shapes.
Application code never reads or writes it — tracking always goes through
`analytics.track()`.

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
off would silence all measurement. The relationship is explicit:

- **analyticsData** = vendor-agnostic source of truth
- **window.dataLayer** = Google/GTM-specific transport/output, written only by
  the GTM adapter's mapper

## The canonical analyticsData envelope

Defined in `lib/analytics/schema.ts` as `AnalyticsData` (schema_version `1.0`):

```jsonc
{
  "event_name": "commerce.add_to_cart",
  "event_id": "9f1c…",                    // unique per event
  "timestamp": "2026-07-26T10:00:00.000Z",
  "schema_version": "1.0",
  "page":    { "path": "/shop", "title": "Shop · Aurora Market",   // governed pageName
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
4. **User-controlled text gets targeted redaction** — the URL and the search
   term are typed by users, so the guard also catches phone numbers and
   percent-encoding there: `page.path` per segment
   (`/account/orders/jane%40x.com` → `/account/orders/[redacted]`),
   `page.query_string` per parameter (`q=[redacted]&category=home`) and
   `search.query` as a whole. Phone detection is deliberately limited to these
   fields (timestamps and event ids are digit runs too), and identifiers such
   as `ORD-1234567` or `prod-1000` are never mistaken for phones. The GTM
   adapter rebuilds `page_location` from the scrubbed path + query, so the
   raw `document.location` never needs to reach GA4.
5. **Titles carry no PII by construction** — see *Page titles* below.

## Page titles — the governed pageName

There is deliberately **no `pageName` attribute** anywhere (schema,
analyticsData, dataLayer). Downstream tools derive pageName from
`page.title` → GA4 `page_title`, so the **title itself is the governed
value**, owned by one module: `lib/routes/page-titles.ts`.

- **One route table** maps every App Router template to its label, area and
  `page_type`. Both Next metadata (`routeMetadata(id)`, `productPageTitle()`)
  and analytics (`pageTypeFromPath`, `resolvePageContext`) read it, so the
  `<title>` and the tracked `page.title` cannot drift apart.
- **Unique per route template, not per instance.** Unbounded ids in titles
  would explode GA4 page-report cardinality, so detail pages use a fixed
  label (`Order Detail · Aurora Market`, `Customer Detail · Aurora Market
  Admin`). No URL segment ever reaches a title.
- **The store PDP is the only entity title** — `{product name} · Aurora
  Market`; a missing or non-purchasable product is `Product Not Found ·
  Aurora Market`. Product names are catalog data, not personal data.
- **Suffixes:** storefront `· Aurora Market`, admin `· Aurora Market Admin`;
  unmatched paths are `Page Not Found · Aurora Market` with page_type
  `not_found`. `/shop` is always `Shop · Aurora Market` — category and search
  refinements are page state (replace-refinements emit no page.view), so a
  category in the title would only be captured on some paths.
- **Guard rails (unit tests, `lib/routes/page-titles.test.ts`):** the
  approved table is pinned; every title is unique and follows the suffix
  convention; no title contains PII, ids, query strings or emojis; every
  `page.tsx` under `app/` has exactly one route-table entry and takes its
  title from the table (a hand-written `title:` fails the build's tests).

**Title race, and why the tracker never reads the DOM.** With streamed
metadata, `document.title` is updated when `generateMetadata` resolves —
which can be after the new page has committed. Reproduced with Playwright on
a production build by delaying the PDP's `generateMetadata`: a home→PDP push
produced a page.view with an **empty** title. Titles are therefore resolved,
not read: fixed-title routes resolve synchronously from the route table; the
PDP registers the title it rendered (`useRegisterPageTitle`, a layout effect,
same `productPageTitle()` as its metadata) in
`lib/routes/page-title-registry.ts`, and the tracker **waits for that
registration** (registry version is an effect dependency — event-driven, no
timers). Every other event's default page context uses the same resolver.

`page_type` values: `home`, `product_list`, `product_detail`, `cart`,
`checkout`, `order_confirmation`, `auth_login`, `auth_signup`, `account`
(all account sub-pages), `not_found`, and for the admin: `admin_login`,
`admin_dashboard`, `admin_product_list`, `admin_product_detail`,
`admin_order_list`, `admin_order_detail`, `admin_customer_list`,
`admin_customer_detail`, `admin_analytics`, `admin_reports`,
`admin_activity`, `admin_ai_assistant`, `admin_settings`.

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
  // Consent signalling seam (Phase 2A): receives the full consent state at
  // startup and on every change, independent of event gating — vendor consent
  // APIs (e.g. Google Consent Mode) must also be able to say "denied".
  onConsentChange?(state: ConsentState): void;
  destroy?(): void;
}
```

## Destination mapping

**GTM / GA4 — implemented in Phase 2A** (`adapters/gtm-adapter.ts`), but
**dormant by default**: activation requires `NEXT_PUBLIC_GTM_CONTAINER_ID`
(a `GTM-XXXXXXX` container ID), which is deliberately unset in this repo. With
no ID the adapter is exactly the Phase 1 placeholder — "Not configured", no
script, no dataLayer writes, no network traffic.

When a container ID is supplied:

1. `initialize()` pushes a **Google Consent Mode default** (every signal
   denied except the always-on `security_storage`/`functionality_storage`),
   THEN seeds `gtm.start` and injects `gtm.js` exactly once.
2. The dispatcher feeds every consent change (and the persisted state at
   startup) to `onConsentChange()`, which pushes a Consent Mode **update** —
   including denied states; that signalling path is intentionally not gated by
   the adapter's own consent category. The neutral→Google mapping lives in
   `consentToGoogleConsentMode()`:
   `analytics → analytics_storage`, `advertising → ad_storage / ad_user_data /
   ad_personalization`, `personalization → personalization_storage`,
   `necessary → security_storage + functionality_storage` (always granted).
3. `track()` — which the dispatcher only calls while the `analytics` category
   is granted — pushes `{ecommerce: null}` before commerce events (GA4's
   stale-item guard) and then the mapped payload:

```ts
// canonical                            // GTM adapter output
"commerce.add_to_cart"          →       window.dataLayer.push({
  commerce.items[0].product_id  →         event: "add_to_cart",
                                          ecommerce: { currency, value,
                                            items: [{ item_id, item_name,
                                                      item_brand, price, quantity }] }
                                        })
```

Every pushed event also carries the page keys `page_title`, `page_type`,
`page_path` and `page_location` — the last rebuilt from the scrubbed
canonical path + query string (never `document.location`). The GTM/GA4
configuration that consumes these keys is in `docs/ga4-gtm-changes.md`.

GA4 naming lives only in `GA4_EVENT_NAME_MAP` — never in components — and
`window.dataLayer` remains a per-vendor output queue, never the model.

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
("Analytics Debugger"). It identifies **analyticsData as the canonical
layer**, and shows per event: timestamp, canonical name, event id, page type,
the full scrubbed `AnalyticsData` envelope, the consent snapshot, and honest
per-adapter status — including, for delivered events, the adapter's own
description of its vendor mapping (e.g. GTM: `mapped to "add_to_cart" on
window.dataLayer`). Unconfigured destinations report **Not configured**; the
debugger never pretends a vendor hit happened. It renders only post-scrub
envelopes from the dispatcher log, so passwords, cookies, tokens and PII can
never appear.

## Instrumentation map

| Journey | Event | Where |
| --- | --- | --- |
| Any committed logical navigation (store, admin, 404) | `page.view` | `components/analytics/page-view-tracker.tsx`, mounted once in the **root** layout (`RootAnalytics`) — deterministic identity via `lib/analytics/navigation.ts`: identical URLs never re-track, and same-pathname `router.replace` query refinements (search keystrokes, filter/sort/pagination) count as page state, not navigations (router transition type supplied by `instrumentation-client.ts`). Title/page_type from the route table, never the DOM (see *Page titles*) |
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

## Current boundaries

The repository itself configures no vendor: the GTM adapter activates only via
the `NEXT_PUBLIC_GTM_CONTAINER_ID` environment variable, and GA4 is wired
**inside the GTM container**, not in application code. Because `NEXT_PUBLIC_*`
values are inlined into the client bundle at build time, each environment
supplies the variable to its own build: local development uses gitignored
`.env.local`, and production uses the `NEXT_PUBLIC_GTM_CONTAINER_ID` GitHub
Actions **repository variable** consumed by `.github/workflows/deploy.yml`
(both the build and deploy steps, since each runs `next build`). Admin
(`/admin/*`) page views are tracked like storefront ones (distinct `admin_*`
page types and the `· Aurora Market Admin` title suffix) and gated by the same
persisted consent; exclude them from GA4 reporting as internal traffic (see
`docs/ga4-gtm-changes.md`). The consent banner and the training debugger stay
storefront-only. Contentsquare and AMTA Lab remain unconfigured
placeholders. AMTA Lab is the author's own educational platform simulating
Adobe-style capabilities — no actual Adobe Analytics, Launch, AEP, Web SDK,
Target, CJA or AJO is integrated, and none will be. Because every destination
consumes the same analyticsData envelopes, adding one never touches business
components.
