# GA4 + GTM changes for the page-title and search release

What to change in Google Tag Manager and GA4 so they consume exactly what the application
pushes, and nothing more. Everything below describes the shipped code:

- `lib/analytics/adapters/gtm-adapter.ts` is the only writer of `window.dataLayer`.
- `lib/routes/page-titles.ts` defines titles and page types.
- `lib/analytics/search.ts` defines the search rules.

The behaviour is pinned by `e2e/page-titles.spec.ts` and `e2e/search.spec.ts`.

Work in a **new GTM workspace**. Test GA4 changes in DebugView, or in a staging property,
until step 8 passes.

**Prerequisite: the site must be built with the container ID.** The application loads GTM
and writes `window.dataLayer` only when `NEXT_PUBLIC_GTM_CONTAINER_ID` is set to a container
ID. The value must be `GTM-` followed by 4 or more upper-case letters or digits. If it is
unset or malformed, the adapter stays *Not configured*: no `gtm.js`, no Consent Mode
commands, no events.

The value is inlined at build time, so rebuild after setting it:
- **Local testing:** set it in `.env.local`.
- **Production:** set it as the GitHub Actions repository variable
  `NEXT_PUBLIC_GTM_CONTAINER_ID`, which the build and deploy steps of
  `.github/workflows/deploy.yml` read.

Before step 8, the storefront footer's **Analytics Debugger** must list *Google Tag Manager*
as configured.

---

## 0. What the site pushes (reference)

**When GTM loads.** `gtm.js` is injected on every page, for every visitor, before and
regardless of any consent decision. The order is fixed:
1. a Consent Mode `default`;
2. `{event: "gtm.js", "gtm.start": …}`;
3. the container script.

A Consent Mode `update` with the visitor's saved choice follows on every page load, and
another follows on every later decision (see 3b).

**Which pushes are gated.** Only the application's own events are gated: they are pushed
only while the visitor has granted the **Analytics** consent category. Each such event is
one `dataLayer.push`. Commerce events are preceded by a separate `{ecommerce: null}` push.

| Key | Example | Notes |
| --- | --- | --- |
| `event` | `page_view` | GA4 names for the mapped events: `page_view`, `search`, `view_item_list`, `select_item`, `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`, `sign_up`, `login`. Two unmapped events arrive under their canonical names: `consent.update` (after Accept All, or Save Preferences with analytics on) and `user.logout`. |
| `event_id` | `9f1c…` | Unique per event. |
| `page_title` | `Shop · Aurora Market` | **The governed pageName.** A fixed label per route template (`lib/routes/page-titles.ts`), in the form `… · Aurora Market` or `… · Aurora Market Admin`. It never contains PII, an id or a URL segment. The one data-driven title is the store PDP: `{product name} · Aurora Market`, or `Product Not Found · Aurora Market` when the product is missing, draft or archived. |
| `page_type` | `product_list` | See the appendix. |
| `page_path` | `/shop` | The pathname with PII segments scrubbed. A segment that is or contains an email, or is a whole phone number, becomes `[redacted]` (`/account/orders/jane%40x.com` → `/account/orders/[redacted]`). Product, order and customer ids are kept. |
| `page_location` | `https://…/shop?q=desk` | Origin + scrubbed path + scrubbed query string. **Use this instead of the tag's automatic URL.** |
| `page_referrer` | `https://…/product/prod-1001` | The `page_location` of the previous `page_view` pushed in this page load. Until one has been pushed, it is the scrubbed browser referrer; that includes the first view after consent is accepted mid-visit. **Omitted** when neither exists. Every event carries the referrer of the page it happened on. **Use this instead of the tag's automatic referrer.** |
| `customer_id` | `C-AB12CD` | The buyer's pseudonymous id, added once the buyer session is known (after sign-up or login, or after the session check that follows a hard load). A signed-in buyer's first `page_view` of a hard-loaded page therefore has none. Never set for admin sessions. **Not cleared at sign-out** (see below). |
| `ecommerce` | `{ items: [...] }` | Commerce events only. |
| `search_term` | `desk` | `search` only. Normalised: Unicode NFKC, whitespace collapsed, trimmed, lower-case, cut to 100 characters. If the term contains an email (even a partial `jane@`) or a phone-shaped number, even percent-encoded, the whole term becomes `[redacted]`. Empty terms are never pushed. |
| `search_results_count` | `7` | `search` only. A non-negative integer: the number of products `/shop` lists for the term. `header` and `suggestion` count store-wide, not the suggestions shown. `shop` counts across all result pages with the active category and price filters. `url` counts the loaded URL, including locally created products. |
| `search_source` | `header` | `search` only: `header`, `shop`, `suggestion` or `url`. |
| `search_zero_results` | `false` | `search` only, boolean. |

**Page views.** `page_view` is pushed exactly once per logical navigation: initial load, link
click, back/forward, and any pathname change. Changes that only refine the same page state
are **not** page views, although they rewrite the URL with `router.replace`:
- filter, sort and pagination changes;
- typing in the shop search box.

Events are **not queued** while consent is missing. On a first visit, the initial
`page_view` and anything else sent before **Accept All** are dropped. Accepting pushes
`consent.update` but does not re-send the current page, so the first `page_view` comes from
the next navigation or reload.

**Searches.** `search` is pushed exactly once per deliberate search, and never while typing.
Its `page_*` keys describe the page where the search happened:
- **`header` and `suggestion`** are pushed *before* navigating, so they carry the page the
  term was typed on (for example `/`, or a PDP), not `/shop`.
- **`shop`** carries `/shop`, with the typed term already in `?q=`.
- **`url`** is pushed after the `/shop?q=…` `page_view` and carries that page.

**Keys are not cleared between pushes.** Apart from the `{ecommerce: null}` reset, each push
adds only the keys that have a value. GTM's data model lasts for the whole page, and in-app
navigation and sign-out do not reload it, so a Data Layer Variable returns the last value
ever pushed:
- The four `search_*` keys keep the previous search on later `page_view` and ecommerce
  pushes.
- `customer_id` keeps the signed-out buyer's id on every push after a sign-out (the
  `user.logout` push itself carries it), until the next full page load.
- `page_referrer` is omitted, not cleared, when there is none.

---

## 1. GTM — Data Layer Variables

**Variables → User-Defined Variables → New → Data Layer Variable**, *Data Layer Version:
Version 2*, *Set Default Value* unchecked.

| Variable name | Data Layer Variable Name |
| --- | --- |
| `DLV - page_title` | `page_title` |
| `DLV - page_type` | `page_type` |
| `DLV - page_path` | `page_path` |
| `DLV - page_location` | `page_location` |
| `DLV - page_referrer` | `page_referrer` |
| `DLV - event_id` | `event_id` |
| `DLV - search_term` | `search_term` |
| `DLV - search_results_count` | `search_results_count` |
| `DLV - search_source` | `search_source` |
| `DLV - search_zero_results` | `search_zero_results` |
| `DLV - customer_id` | `customer_id` |

Usage rules (because keys persist, see §0):

- Use the four `DLV - search_*` variables **only** in tags fired by `CE - search`. Every
  `search` push sets all four, but they keep their old values on every later event.
- `DLV - customer_id` is for Tag Assistant inspection only. **Do not map it to `user_id` or
  send it as a parameter.** The site never pushes a cleared value at sign-out, so it would
  keep returning the previous buyer's id until the next full page load.
- `DLV - event_id` is optional. Add it to `GA4 - Event settings` as `event_id` if you want to
  trace a GA4 hit back to its push.
- `ecommerce` needs no variable: GA4 ecommerce tags read it with *Send Ecommerce data →
  Data Layer*.

Add one derived variable for internal traffic, used in step 5. It keys on the path, not the
page type, so admin 404s are caught too (see step 5):

- **Variables → New → RegEx Table**, name `RT - traffic_type`
  - Input Variable: `{{DLV - page_path}}`
  - Row: Pattern `^/admin(/|$)` → Output `internal`
  - *Set Default Value*: unchecked. Leave it empty so storefront hits carry no
    `traffic_type`.

---

## 2. GTM — Custom Event triggers

**Triggers → New → Custom Event**:

| Trigger name | Event name | Fires on |
| --- | --- | --- |
| `CE - page_view` | `page_view` | All Custom Events |
| `CE - search` | `search` | All Custom Events |

Leave "Use regex matching" off. Keep the existing ecommerce, `sign_up` and `login`
triggers.

Do **not** add any of these:
- a *History Change* trigger;
- a *Page View*, *DOM Ready* or *Window Loaded* trigger for GA4 page views, since the
  application already emits the SPA page view (see step 4);
- a catch-all (regex `.*`) Custom Event trigger, which would forward `consent.update`,
  `user.logout` and the `gtm.*` lifecycle events.

---

## 3. GTM — Google tag and GA4 event tags

### 3a. Shared event settings

**Variables → New → Google Tag: Event Settings**, name `GA4 - Event settings`:

| Parameter | Value |
| --- | --- |
| `page_location` | `{{DLV - page_location}}` |
| `page_referrer` | `{{DLV - page_referrer}}` |
| `page_title` | `{{DLV - page_title}}` |
| `page_type` | `{{DLV - page_type}}` |
| `traffic_type` | `{{RT - traffic_type}}` |

Attach this variable to **every** GA4 event tag, including the existing ecommerce, `sign_up`
and `login` tags. Overriding `page_location` and `page_referrer` on each event keeps a URL
typed with an email out of GA4 (for example `/account/orders/jane@x.com` or
`/shop?q=jane@x.com`). The adapter's values are already redacted; the browser's
`document.location` and `document.referrer` are not.

### 3b. Google tag (configuration)

Open the existing **Google Tag** (tag ID `G-…`). Leave its trigger as *Initialization - All
Pages*. Under **Configuration settings → Configuration parameter**, add:

| Parameter | Value |
| --- | --- |
| `send_page_view` | `false` |

**Consent.** Do not add a CMP template or a second consent default in GTM. The site already
sends Consent Mode commands in this order:
1. Before `gtm.js` is requested, a `default`. It denies `ad_storage`, `ad_user_data`,
   `ad_personalization`, `analytics_storage` and `personalization_storage`, and grants
   `functionality_storage` and `security_storage`.
2. On every page load, an `update` with the visitor's saved choice. It is queued right after
   the `gtm.js` message, so tags on the Initialization trigger see the default first.
3. Another `update` on every later decision, including a withdrawal.

Category mapping: Analytics → `analytics_storage`; Advertising → `ad_storage`,
`ad_user_data`, `ad_personalization`; Personalization → `personalization_storage`.

Because the container loads for every visitor, only the application's own events are gated
by the Analytics category. Anything the container fires on its own triggers is governed by
Consent Mode alone. That covers All Pages, clicks, timers, and Enhanced Measurement. Keep
the GA4 tags on the `CE - …` triggers above, and switch off the Enhanced Measurement events
listed in step 4.

### 3c. GA4 event tag — page_view

**Tags → New → Google Analytics: GA4 Event**, name `GA4 - page_view`:

- **Measurement ID:** same `G-…`
- **Event Name:** `page_view`
- **Event Settings Variable:** `{{GA4 - Event settings}}`, which provides `page_location`,
  `page_referrer`, `page_title`, `page_type` and `traffic_type`.
- **Event Parameters:** none extra needed.
- **Trigger:** `CE - page_view`

### 3d. GA4 event tag — search

**Tags → New → Google Analytics: GA4 Event**, name `GA4 - search`:

- **Measurement ID:** same `G-…`
- **Event Name:** `search`
- **Event Settings Variable:** `{{GA4 - Event settings}}`
- **Event Parameters:**

  | Parameter | Value |
  | --- | --- |
  | `search_term` | `{{DLV - search_term}}` |
  | `search_results_count` | `{{DLV - search_results_count}}` |
  | `search_source` | `{{DLV - search_source}}` |
  | `search_zero_results` | `{{DLV - search_zero_results}}` |

- **Trigger:** `CE - search`

`search` is GA4's recommended event name for a site search, and `search_term` feeds GA4's
built-in **Search term** dimension.

Each `search` hit is attributed to the page it was submitted from (§0), so header and
suggestion searches appear under the page the visitor was on, not `/shop`.

### 3e. Existing tags

- **Ecommerce tags and `sign_up` / `login` tags:** keep their triggers, and attach
  `{{GA4 - Event settings}}` so they also carry the scrubbed `page_location`,
  `page_referrer` and `page_type`. The ecommerce events are `view_item_list`,
  `select_item`, `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`,
  `begin_checkout`, `add_shipping_info`, `add_payment_info` and `purchase`.
- **`consent.update` and `user.logout`:** these arrive under their canonical names and need
  no GA4 tag.
- **Built-in page variables:** delete or pause any tag that still reads `{{Page URL}}`,
  `{{Page Path}}`, `{{Page Title}}` or `{{Referrer}}`. These built-ins read the live
  URL, DOM and `document.referrer`, which are unscrubbed, and the title can lag behind a
  client-side navigation. Use the `DLV - page_*` variables instead.

---

## 4. Duplicate risks to neutralise

All the Enhanced Measurement settings below are in GA4 under **Admin → Data collection and
modification → Data streams → (web stream) → Enhanced measurement → ⚙︎**.

**1. GA4 Enhanced Measurement "Site search"**
- **Risk:** it would emit `view_search_results` for every page whose URL has `?q=` (the
  shop's search parameter), including deep links the app already reports as `search`
  (`search_source: url`). That double-counts searches under a different name, from the
  unscrubbed URL.
- **Fix:** turn **Site search** **off**.

**2. "Page changes based on browser history events"**
- **Risk:** gtag watches `pushState`, `replaceState` and `popstate`, and sends its own
  `page_view` whenever the URL changes without a reload.
  - This doubles the app's `page_view` on every link click and every back/forward.
  - It also adds page views the app deliberately does not send: every keystroke in the shop
    search box, and every category, price, sort or page change, is a same-path
    `router.replace`. With Site search on, each of those would also become a
    `view_search_results` for a partial term.
  - It reads the unscrubbed URL and a possibly stale `document.title`.
- **Fix:** in **Page views → Show advanced settings**, **uncheck** "Page changes based on
  browser history events". Keep "Page views" itself on: with `send_page_view=false` it sends
  nothing on load.

**3. The Google tag's automatic `page_view`**
- **Risk:** on the initial load it would duplicate the app's initial `page_view`.
- **Fix:** set `send_page_view` = `false` on the Google tag (step 3b).

**4. Enhanced Measurement "Form interactions"**
- **Risk:** both search boxes are real `<form role="search">` elements, so every search would
  also produce `form_start` and `form_submit`. The same goes for login, sign-up, profile,
  address and admin forms. None has an `action`, so `form_destination` would be the current,
  unscrubbed URL.
- **Fix:** turn **Form interactions** **off**. Searches, sign-ins and sign-ups are already
  `search`, `login` and `sign_up`. Checkout has no `<form>`; its steps are the ecommerce
  funnel events.

**5. The remaining Enhanced Measurement events** (Scrolls, Outbound clicks, Video
engagement, File downloads)
- **Risk:** gtag builds these itself from the browser's unscrubbed `document.location`, and
  the shop writes the raw typed term into `?q=`. Because `gtm.js` loads for every visitor,
  they also go out as Consent Mode cookieless pings for visitors who never granted
  analytics. The app pushes nothing for them.
- **Fix:** turn them **off**. Afterwards, only "Page views" is on, with history-based
  page changes unchecked.

**6. A leftover *History Change* trigger or a hard-coded `gtag('config', …)` snippet**
- **Risk:** either would send page views on its own. None exist in the app: its only
  Google script is `gtm.js`, and its local `gtag()` shim sends only Consent Mode commands.
- **Fix:** delete any History Change trigger in GTM.

---

## 5. Internal-traffic exclusion for /admin

Admin pages are tracked, and `page_path` always starts with `/admin`:
- **Known admin routes** have `page_type` `admin_*` and titles `… · Aurora Market Admin`.
- **Unknown URLs under `/admin`** (for example `/admin/foo`) render the global 404, with
  `page_type: not_found` and `page_title: Page Not Found · Aurora Market`.

That is why `RT - traffic_type` (steps 1 and 3a) keys on `page_path` `^/admin(/|$)`, not on
the page type, and tags every such hit `traffic_type = internal`.

Admin pages send `page_view` only; the admin global search is deliberately untracked. They
send it only in a browser that has granted analytics consent on the storefront: there is no
consent banner or Cookie Settings link under `/admin`.

In GA4:

1. Go to **Admin → Data collection and modification → Data filters → Create filter →
   Internal traffic**. Name it `Internal (admin)`, set the operation to **Exclude**, and the
   parameter value to **`internal`**. GA4's IP-based "Define internal traffic" rules are
   optional: the filter matches the `traffic_type` parameter however it was set.
2. Leave the filter in **Testing** first. In reports, add the dimension **Test data filter
   name**, and confirm that only hits whose **Page path** starts with `/admin` match. That
   means every `admin_*` page type, plus admin 404s.
3. Switch it to **Active**. Excluded data is not recoverable.

Alternatively, add a trigger exception `DLV - page_path matches RegEx ^/admin(/|$)` to the
GA4 tags. That drops admin hits at the source, but you lose the ability to test the filter.

---

## 6. GA4 custom dimensions (event-scoped)

**Admin → Data display → Custom definitions → Create custom dimension**, scope **Event**:

| Dimension name | Event parameter |
| --- | --- |
| Page type | `page_type` |
| Search source | `search_source` |
| Search results count | `search_results_count` |
| Search zero results | `search_zero_results` |

These don't need a custom dimension, because GA4 has built-ins:
- `search_term` → **Search term**
- `page_title` → **Page title**
- `page_location` → **Page location** / **Page path**

Optional extras:
- Register `search_results_count` as a **custom metric** (unit: Standard) to average result
  counts.
- Register `event_id` only if you need it in reports.

New definitions populate from the moment they are created; allow 24–48 h in standard
reports.

---

## 7. Reports and explorations to validate

**1. Pages by title**
- **Where:** *Reports → Engagement → Pages and screens*, primary dimension **Page title and
  screen class**. Add the secondary dimension **Page type** to check the mapping.
- **Expect only approved titles**, for example:
  - `Home · Aurora Market`, `Shop · Aurora Market`, `Image Credits · Aurora Market`
  - `{product} · Aurora Market`
  - `Product Not Found · Aurora Market`: a PDP whose product is missing, draft or archived
    (page type `product_detail`)
  - `Order Detail · Aurora Market`
  - `Page Not Found · Aurora Market` (page type `not_found`)
- **Expect none of these:**
  - `Commerce Intelligence Lab` titles
  - customer names, order ids or customer ids
  - empty titles
  - once the internal filter is Active, `… · Aurora Market Admin` rows

**2. Search terms**
- **Where:** *Explore → Free form*. Rows **Search term**, columns **Search source**, values
  **Event count**, filter **Event name exactly matches `search`**.
- **Expect:** sources `header`, `shop`, `suggestion` and `url`. No partial terms (`de`,
  `des`), and no emails or phone numbers (they appear as `[redacted]`).

**3. Zero-result searches**
- **Where:** the same exploration with the filter **Search zero results exactly matches
  `true`**; rows **Search term**, values **Event count**. Confirm in DebugView whether the
  boolean arrives as the text `true` / `false`.
- **Use:** this is the merchandising gap list.

**4. No duplicates**
- **Where:** *Explore → Free form*, rows **Event name**, filter Page path = `/shop`.
- **Expect** only the app's events (`page_view`, `search`, `view_item_list`, `select_item`,
  `add_to_cart`) plus GA4's automatic session events.
- **Must not appear:** `view_search_results`, `form_start`, `form_submit`, `scroll` or
  `click`.
- **Note:** header and suggestion searches are recorded against the page the visitor
  searched *from*, so most of them appear under other page paths.

---

## 8. DebugView / GTM Preview test script

**Setup**
1. Start **GTM Preview** (Tag Assistant) on the site.
2. Open **GA4 → Admin → DebugView**.
3. Use a fresh browser profile.

**Reading the Tag Assistant left rail.** Each `dataLayer` push is one entry:
- A push without an `event` key shows as *Message*. That is the `{ecommerce: null}` reset
  that precedes every commerce event.
- Consent Mode commands show as *Consent*.
- For each entry, check *Tags Fired* and *Variables*.

**Reading the table below.** It lists the named events only; the ecommerce reset before each
commerce event is omitted. `view_item_list` is debounced: it is pushed about 0.5 s after the
product list settles.

| # | Action | Expected dataLayer events (in order) | Expected GA4 hits |
| --- | --- | --- | --- |
| 1 | Open `/` and click **Accept All** on the consent banner. Tag Assistant shows a Consent update (all granted) and a `consent.update` message that no tag uses. Then **reload**; events before consent are blocked by design. | `page_view` `{page_title: "Home · Aurora Market", page_type: "home", page_path: "/"}` | 1 × `page_view`; no automatic or duplicate page_view |
| 2 | Click any product card. | `select_item`, `page_view` `{page_title: "<Product name> · Aurora Market", page_type: "product_detail", page_referrer: "…/"}`, `view_item` | exactly 1 `page_view` for the PDP |
| 3 | On the PDP, click a related product, then browser **Back**, then **Forward**. | Click: `select_item`, `page_view`, `view_item`. Back and Forward: `page_view`, `view_item`. Every `page_view` has **that** product's title. | 3 × `page_view`; titles match the tab title |
| 4 | In the header search, type `desk` slowly. Do not press Enter. | nothing | nothing |
| 5 | Press **Enter**. | `search` `{search_term: "desk", search_source: "header", search_results_count: N (= the /shop grid count), search_zero_results: false, page_path/page_type of the PDP you searched from}`, **then** `page_view` `{page_path: "/shop", page_location: "…/shop?q=desk"}`, then `view_item_list` | 1 × `search`, 1 × `page_view`; **no** `view_search_results`, **no** `form_submit` |
| 6 | Clear the shop's own search box (it shows `desk` from step 5), type `lamp`, then press **Enter**. | Once typing settles: `view_item_list` (not a search). On Enter only: `search` `{search_term: "lamp", search_source: "shop"}`. **No** `page_view`. | 1 × `search` |
| 7 | Click back into the shop box (Enter blurred it) and press **Enter** again without changing the text. | nothing (duplicate suppressed) | nothing |
| 8 | Type `lamps` in the shop box, then click elsewhere on the page without pressing Enter. | `view_item_list` only; blur is not a submit | no `search` |
| 9 | Change Category, Sort, or the results page in the shop filters. | `view_item_list` about 0.5 s after each settled change, never a `page_view` | no `page_view` |
| 10 | Clear the header box (it still shows `desk`), type `desk`, then click a **suggestion**. | `search` `{search_source: "suggestion"}`, `page_view` (PDP), `view_item` | 1 × `search` |
| 11 | In the header, type `desk` and click **See all results**. | `search` `{search_source: "header"}`, `page_view` `/shop?q=desk`, `view_item_list` | 1 × `search` |
| 12 | Open `/shop?q=desk` directly in the address bar, then **reload** it. | Each time: `page_view`, `search` `{search_source: "url"}`, `view_item_list`. A refresh is a new search. | 1 × `search` per load |
| 13 | From step 12, click a product, then **Back** to `/shop?q=desk`. | Click: `select_item`, `page_view` (PDP), `view_item`. Back: `page_view` `{page_path: "/shop", page_location: "…/shop?q=desk"}`, `view_item_list`. **No** `search`; history is not a new search. | no second `search` |
| 14 | Clear the header box, search `qqqzzz`, and press Enter. | `search` `{search_term: "qqqzzz", search_source: "header", search_results_count: 0, search_zero_results: true}`, `page_view` `{page_location: "…/shop?q=qqqzzz"}`, `view_item_list` | appears in the zero-results exploration |
| 15 | Clear the header box, search `jane.doe@example.com`, and press Enter. Then click any product. | `search` `{search_term: "[redacted]"}`, `page_view` `{page_location: "…/shop?q=[redacted]"}`. The product's `page_view` carries `page_referrer: "…/shop?q=[redacted]"`. | no email anywhere in DebugView |
| 16 | Signed in as a buyer, visit `/account/orders/jane%40example.com`, then click **My Orders** in the account navigation. | `page_view` `{page_title: "Order Detail · Aurora Market", page_path: "/account/orders/[redacted]"}`, then `page_view` `{page_path: "/account/orders", page_referrer: "…/account/orders/[redacted]"}` | page_location and page_referrer redacted |
| 17 | Visit `/definitely-missing`. | `page_view` `{page_title: "Page Not Found · Aurora Market", page_type: "not_found"}` | — |
| 18 | Open `/admin/login`, sign in, then open **Products**, a product, **Customers**, and a customer. | One `page_view` per page: `Sign In · Aurora Market Admin` / `admin_login`, `Dashboard · Aurora Market Admin` / `admin_dashboard`, `Products · Aurora Market Admin` / `admin_product_list`, `Product Detail · Aurora Market Admin` / `admin_product_detail`, `Customers · Aurora Market Admin` / `admin_customer_list`, `Customer Detail · Aurora Market Admin` / `admin_customer_detail`. Never a customer name. | each hit carries `traffic_type = internal`; filtered out once the data filter is Active |
| 19 | Visit `/admin/does-not-exist` while signed in. | `page_view` `{page_title: "Page Not Found · Aurora Market", page_type: "not_found", page_path: "/admin/does-not-exist"}` | carries `traffic_type = internal` (path-based) |
| 20 | Use the admin top-bar search: type `lamp`, then press Enter (or click a result). | Typing: nothing. Enter or click: only the destination's `page_view` (for example `Product Detail · Aurora Market Admin`). **Never** `search`. | no `search`; admin search is deliberately untracked |
| 21 | On a phone, or in device emulation: open the menu, type `lamp` in its search box, and press the keyboard's Search key. On `/shop`, do the same in the shop box. | Menu: exactly one `search` `{search_source: "header"}`, then `page_view` `/shop?q=lamp`. Shop box: one `search` `{search_source: "shop"}`, and the keyboard closes. | 1 × `search` each |
| 22 | Back on the storefront, open **Cookie Settings** in the footer, switch Analytics off, click **Save Preferences**, then navigate. | No event pushes. A Consent update with `analytics_storage: denied` is pushed. | no hits |

**Canonical-side cross-check** at any point, in the DevTools console:
- `window.analyticsData.page` shows the canonical context of the last page view: `path`,
  `title`, `page_type` and `query_string`.
- `window.analyticsData.last_search` shows the last search: `query`, `results_count`,
  `search_source` and `zero_results`.
- `window.analyticsData.events` lists the last 20 canonical envelopes.
- `window.analyticsData.destinations` shows whether `gtm` is configured.

This inspector logs canonical events **even when consent blocks delivery** or GTM is not
configured. Compare it with the dataLayer only while analytics is granted.
`page_location` and `page_referrer` exist only in the dataLayer push.

---

### Appendix — page_type values

**Store:**
- `home`, `product_list`, `product_detail`, `cart`, `checkout`, `order_confirmation`
- `auth_login`, `auth_signup`
- `account`, used by all five account pages
- `content`, used by `/credits`
- `not_found`

**Admin:**
- `admin_login`, `admin_dashboard`
- `admin_product_list`, `admin_product_detail`
- `admin_order_list`, `admin_order_detail`
- `admin_customer_list`, `admin_customer_detail`
- `admin_analytics`, `admin_reports`, `admin_activity`, `admin_ai_assistant`,
  `admin_settings`

`not_found` covers only URLs that match no route template. An unknown id under a real
template keeps that route's type. For example, `/product/unknown` → `product_detail`,
titled `Product Not Found · Aurora Market`. The schema's `other` value is a server-side
placeholder and never reaches `window.dataLayer`.
