/**
 * Storefront category-filtering regression tests.
 *
 * Run: node --experimental-strip-types --test lib/catalog/shop-query.test.ts
 * (wired as `npm run test:catalog`).
 *
 * These exercise the EXACT code the browser runs. `<ShopView>` holds no view
 * state of its own: it calls `parseShopQuery(useSearchParams())` and
 * `selectShopPage(products, query)`, and the server page derives its heading
 * from the same `parseShopQuery`. So asserting on these functions asserts on
 * what the page renders — on desktop and on mobile, which differ only in
 * layout and share this logic.
 *
 * The catalog under test is the real generated catalog (the same records the
 * D1 seed was built from) — no per-category fixtures.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { products } from "@/lib/data/products";
import { isPurchasable } from "@/lib/commerce";
import {
  ALL_CATEGORIES,
  CATEGORIES,
  categoryName,
  categorySelectionLabel,
  PRIMARY_NAV_CATEGORIES,
  SECONDARY_NAV_CATEGORIES,
  type CategorySelection,
} from "./categories.ts";
import {
  buildShopParams,
  categoryHref,
  DEFAULT_SHOP_SORT,
  parseShopQuery,
  PRICE_BUCKETS,
  selectShopPage,
  selectShopProducts,
  SHOP_PAGE_SIZE,
  SHOP_SORT_KEYS,
  shopHref,
  type ShopQuery,
} from "./shop-query.ts";

/** Parse a real URL the way the page does (server) and ShopView does (client). */
function queryFromUrl(url: string): ShopQuery {
  return parseShopQuery(new URL(url, "http://localhost:3000").searchParams);
}

/** Everything the shop would render for a URL, ignoring pagination. */
function productsFor(url: string) {
  return selectShopProducts(products, queryFromUrl(url));
}

const buyerVisible = products.filter(isPurchasable);

/* -------------------------------------------------------------------------- */
/*  1. Top category navigation                                                */
/* -------------------------------------------------------------------------- */

test("All Products shows the complete buyer-visible catalog", () => {
  const result = productsFor("/shop");
  assert.equal(result.length, buyerVisible.length);
  assert.ok(result.length > 0, "catalog should not be empty");

  // Every category is represented — nothing is filtered out by default.
  const seen = new Set(result.map((p) => p.categoryId));
  assert.deepEqual([...seen].sort(), CATEGORIES.map((c) => c.id).sort());
});

test("every category shows ONLY that category's products", () => {
  for (const category of CATEGORIES) {
    for (const param of [category.id, category.name]) {
      const result = productsFor(`/shop?category=${encodeURIComponent(param)}`);
      assert.ok(result.length > 0, `no products for ${param}`);
      for (const product of result) {
        assert.equal(
          product.categoryId,
          category.id,
          `?category=${param} returned ${product.name} (${product.category})`,
        );
      }
      // ...and it shows ALL of that category's buyer-visible products.
      const expected = buyerVisible.filter((p) => p.categoryId === category.id);
      assert.equal(result.length, expected.length, `wrong count for ${param}`);
    }
  }
});

test("REGRESSION: ?category=Gaming can never render Electronics products", () => {
  // The production bug: the URL and heading said Gaming while the grid showed
  // Electronics (Bluetooth trackers, wireless chargers) held in stale state.
  for (const url of ["/shop?category=Gaming", "/shop?category=gaming"]) {
    const query = queryFromUrl(url);

    // The heading, the nav highlight and the dropdown all read this one value.
    assert.equal(query.category, "gaming");
    assert.equal(categorySelectionLabel(query.category), "Gaming");

    const result = selectShopProducts(products, query);
    assert.ok(result.length > 0, `no Gaming products for ${url}`);

    for (const product of result) {
      assert.equal(product.categoryId, "gaming", `${url} leaked ${product.name}`);
      assert.notEqual(product.categoryId, "electronics");
      assert.notEqual(product.category, "Electronics");
    }

    // Explicitly: the named products from the bug report are absent.
    const leaked = result.filter((p) =>
      /bluetooth tracker|wireless charger/i.test(p.name),
    );
    assert.deepEqual(leaked, [], `${url} rendered Electronics products`);
  }

  // And the Electronics products really do exist in the catalog — so the
  // assertion above passes because filtering works, not because the catalog is
  // missing the records that used to leak.
  const electronics = productsFor("/shop?category=Electronics");
  assert.ok(
    electronics.some((p) => /bluetooth tracker|wireless charger/i.test(p.name)),
    "expected the leaked products to live under Electronics",
  );
});

test("category filtering is disjoint — no product appears under two categories", () => {
  const counts = new Map<string, number>();
  for (const category of CATEGORIES) {
    for (const product of productsFor(`/shop?category=${category.id}`)) {
      counts.set(product.id, (counts.get(product.id) ?? 0) + 1);
    }
  }
  const duplicated = [...counts.entries()].filter(([, n]) => n > 1);
  assert.deepEqual(duplicated, []);
  // The per-category sets partition the whole catalog.
  assert.equal(counts.size, buyerVisible.length);
});

/* -------------------------------------------------------------------------- */
/*  2. Direct URL navigation & refresh                                        */
/* -------------------------------------------------------------------------- */

test("direct navigation to a category URL resolves canonically", () => {
  assert.equal(queryFromUrl("/shop?category=Gaming").category, "gaming");
  assert.equal(queryFromUrl("/shop?category=gaming").category, "gaming");
  assert.equal(queryFromUrl("/shop?category=GAMING").category, "gaming");
  assert.equal(queryFromUrl("/shop?category=Electronics").category, "electronics");
  assert.equal(queryFromUrl("/shop").category, ALL_CATEGORIES);
});

test("an unknown category falls back to the full catalog, not an empty grid", () => {
  const query = queryFromUrl("/shop?category=Gamming");
  assert.equal(query.category, ALL_CATEGORIES);
  assert.equal(categorySelectionLabel(query.category), "All Products");
  assert.equal(selectShopProducts(products, query).length, buyerVisible.length);
});

test("refresh preserves category and every other filter (URL round-trips)", () => {
  const urls = [
    "/shop?category=gaming",
    "/shop?category=gaming&sort=price-asc",
    "/shop?category=beauty&price=25-100&sort=rating&q=serum",
    "/shop?category=electronics&page=2",
    "/shop",
  ];
  for (const url of urls) {
    const query = queryFromUrl(url);
    // Re-serialising and re-parsing yields the identical query — which is what
    // a refresh, a share, or a back/forward does.
    const reparsed = parseShopQuery(buildShopParams(query));
    assert.deepEqual(reparsed, query, url);
    // And the rendered set is identical too.
    assert.deepEqual(
      selectShopProducts(products, reparsed).map((p) => p.id),
      selectShopProducts(products, query).map((p) => p.id),
      url,
    );
  }
});

test("legacy display-name URLs and canonical slug URLs render the same grid", () => {
  for (const category of CATEGORIES) {
    assert.deepEqual(
      productsFor(`/shop?category=${category.name}`).map((p) => p.id),
      productsFor(`/shop?category=${category.id}`).map((p) => p.id),
      category.name,
    );
  }
});

/* -------------------------------------------------------------------------- */
/*  3. Dropdown / heading / nav synchronisation                               */
/* -------------------------------------------------------------------------- */

test("heading, nav highlight and category dropdown all read one value", () => {
  for (const url of ["/shop", "/shop?category=Gaming", "/shop?category=beauty"]) {
    const query = queryFromUrl(url);

    // <ShopView> passes query.category straight to the Select's `value`, and
    // the Select's options are keyed by category id — so the dropdown shows
    // exactly this category and nothing else can be selected in the UI.
    const dropdownValue = query.category;
    const headingText = categorySelectionLabel(query.category);
    // <CategoryNav> marks an entry active when its selection === this value.
    const activeNavEntry: CategorySelection = query.category;

    assert.equal(dropdownValue, query.category);
    assert.equal(activeNavEntry, query.category);
    assert.equal(
      headingText,
      query.category === ALL_CATEGORIES ? "All Products" : categoryName(query.category),
    );
    for (const product of selectShopProducts(products, query)) {
      assert.ok(
        query.category === ALL_CATEGORIES || product.categoryId === dropdownValue,
        `grid disagrees with dropdown for ${url}`,
      );
    }
  }
});

test("'All Products' is active only when no category is selected", () => {
  const isAllActive = (url: string) => queryFromUrl(url).category === ALL_CATEGORIES;
  assert.equal(isAllActive("/shop"), true);
  assert.equal(isAllActive("/shop?sort=price-asc"), true);
  assert.equal(isAllActive("/shop?category=gaming"), false);
  assert.equal(isAllActive("/shop?category=Electronics"), false);
});

/* -------------------------------------------------------------------------- */
/*  4. Mobile parity                                                          */
/* -------------------------------------------------------------------------- */

test("mobile drawer and desktop bar mint identical, resolvable hrefs", () => {
  // <CategoryNav> builds both layouts from the same entries and the same
  // `categoryHref`, so mobile can only ever navigate to the same canonical URL.
  const desktop = PRIMARY_NAV_CATEGORIES.map((c) => categoryHref(c.id));
  const mobile = [...PRIMARY_NAV_CATEGORIES, ...SECONDARY_NAV_CATEGORIES].map((c) =>
    categoryHref(c.id),
  );

  for (const href of desktop) assert.ok(mobile.includes(href), href);

  for (const category of [...PRIMARY_NAV_CATEGORIES, ...SECONDARY_NAV_CATEGORIES]) {
    const href = categoryHref(category.id);
    assert.equal(href, `/shop?category=${category.id}`);
    const query = queryFromUrl(href);
    assert.equal(query.category, category.id);
    for (const product of selectShopProducts(products, query)) {
      assert.equal(product.categoryId, category.id, `${href} on mobile`);
    }
  }

  assert.equal(categoryHref(ALL_CATEGORIES), "/shop", "All Products is the bare /shop URL");
});

/* -------------------------------------------------------------------------- */
/*  5. Filter combinations                                                    */
/* -------------------------------------------------------------------------- */

test("category + sorting: sorting never changes WHICH products are shown", () => {
  const base = productsFor("/shop?category=gaming");
  const baseIds = [...base.map((p) => p.id)].sort();

  for (const sort of SHOP_SORT_KEYS) {
    const sorted = productsFor(`/shop?category=gaming&sort=${sort}`);
    assert.deepEqual(
      [...sorted.map((p) => p.id)].sort(),
      baseIds,
      `sort=${sort} changed the Gaming dataset`,
    );
    for (const product of sorted) assert.equal(product.categoryId, "gaming");
    // Changing sort must not clear the category in the URL either.
    assert.equal(queryFromUrl(`/shop?category=gaming&sort=${sort}`).category, "gaming");
  }
});

test("each sort key orders the filtered set correctly", () => {
  const priceAsc = productsFor("/shop?category=gaming&sort=price-asc");
  for (let i = 1; i < priceAsc.length; i += 1) {
    assert.ok(priceAsc[i - 1].price <= priceAsc[i].price, "price-asc out of order");
  }

  const priceDesc = productsFor("/shop?category=gaming&sort=price-desc");
  for (let i = 1; i < priceDesc.length; i += 1) {
    assert.ok(priceDesc[i - 1].price >= priceDesc[i].price, "price-desc out of order");
  }
  assert.deepEqual(
    priceDesc.map((p) => p.id),
    [...priceAsc].reverse().map((p) => p.id),
    "price-desc should mirror price-asc",
  );

  const rating = productsFor("/shop?category=gaming&sort=rating");
  for (let i = 1; i < rating.length; i += 1) {
    assert.ok(rating[i - 1].rating >= rating[i].rating, "rating out of order");
  }

  const popularity = productsFor("/shop?category=gaming&sort=popularity");
  for (let i = 1; i < popularity.length; i += 1) {
    assert.ok(
      popularity[i - 1].unitsSold >= popularity[i].unitsSold,
      "popularity out of order",
    );
  }

  // Featured: rating first, units sold as the tie-break.
  const featured = productsFor("/shop?category=gaming&sort=featured");
  for (let i = 1; i < featured.length; i += 1) {
    const prev = featured[i - 1];
    const cur = featured[i];
    assert.ok(
      prev.rating > cur.rating ||
        (prev.rating === cur.rating && prev.unitsSold >= cur.unitsSold),
      "featured out of order",
    );
  }
  assert.deepEqual(
    featured.map((p) => p.id),
    productsFor("/shop?category=gaming").map((p) => p.id),
    "featured is the default sort",
  );
});

test("sorting is deterministic (stable tie-breaks), so SSR and hydration agree", () => {
  for (const sort of SHOP_SORT_KEYS) {
    const a = productsFor(`/shop?sort=${sort}`).map((p) => p.id);
    const b = productsFor(`/shop?sort=${sort}`).map((p) => p.id);
    assert.deepEqual(a, b, `sort=${sort} is not deterministic`);
  }
});

test("category + search", () => {
  const url = "/shop?category=gaming&q=mouse";
  const query = queryFromUrl(url);
  assert.equal(query.category, "gaming");
  assert.equal(query.q, "mouse");

  const result = selectShopProducts(products, query);
  assert.ok(result.length > 0, "expected Gaming products matching 'mouse'");
  for (const product of result) {
    assert.equal(product.categoryId, "gaming");
    assert.ok(/mouse/i.test(`${product.name} ${product.brand}`), product.name);
  }

  // The same search across the whole catalog is a superset — proving the
  // category really narrowed it rather than the search replacing it.
  const everywhere = productsFor("/shop?q=mouse");
  assert.ok(everywhere.length >= result.length);
  for (const product of result) {
    assert.ok(everywhere.some((p) => p.id === product.id));
  }
});

test("search matches name, brand and category label", () => {
  assert.ok(productsFor("/shop?q=gaming").every((p) => p.categoryId === "gaming"));
  assert.ok(productsFor("/shop?q=vortex").every((p) => /vortex/i.test(p.brand)));
  assert.equal(productsFor("/shop?q=zzzzzznope").length, 0);
});

test("category + price filter", () => {
  for (const bucket of PRICE_BUCKETS) {
    const query = queryFromUrl(`/shop?category=gaming&price=${bucket.id}`);
    assert.equal(query.category, "gaming", "price must not clear the category");
    assert.equal(query.price, bucket.id);

    const result = selectShopProducts(products, query);
    for (const product of result) {
      assert.equal(product.categoryId, "gaming");
      assert.ok(
        product.price >= bucket.min && product.price < bucket.max,
        `${product.name} at ${product.price} is outside ${bucket.label}`,
      );
    }
  }

  // The buckets partition the category: every product lands in exactly one.
  const all = productsFor("/shop?category=gaming").length;
  const bucketed = PRICE_BUCKETS.reduce(
    (sum, b) => sum + productsFor(`/shop?category=gaming&price=${b.id}`).length,
    0,
  );
  assert.equal(bucketed, all);
});

test("category + search + price + sort all compose", () => {
  const query = queryFromUrl("/shop?category=electronics&q=a&price=100-250&sort=price-desc");
  assert.deepEqual(
    { category: query.category, q: query.q, price: query.price, sort: query.sort },
    { category: "electronics", q: "a", price: "100-250", sort: "price-desc" },
  );
  const result = selectShopProducts(products, query);
  for (const product of result) {
    assert.equal(product.categoryId, "electronics");
    assert.ok(product.price >= 100 && product.price < 250);
    assert.ok(/a/i.test(`${product.name} ${product.brand} ${product.category}`));
  }
  for (let i = 1; i < result.length; i += 1) {
    assert.ok(result[i - 1].price >= result[i].price);
  }
});

/* -------------------------------------------------------------------------- */
/*  6. URL building                                                           */
/* -------------------------------------------------------------------------- */

test("buildShopParams omits defaults and always writes the canonical slug", () => {
  assert.equal(buildShopParams({}).toString(), "");
  assert.equal(shopHref({}), "/shop");
  assert.equal(shopHref({ category: "gaming" }), "/shop?category=gaming");
  assert.equal(
    shopHref({ category: "gaming", sort: "price-asc" }),
    "/shop?category=gaming&sort=price-asc",
  );
  assert.equal(shopHref({ sort: DEFAULT_SHOP_SORT }), "/shop", "default sort is omitted");
  assert.equal(shopHref({ page: 1 }), "/shop", "page 1 is omitted");
  assert.equal(shopHref({ category: "gaming", page: 3 }), "/shop?category=gaming&page=3");
  assert.equal(shopHref({ q: "  mouse  " }), "/shop?q=mouse", "query is trimmed");
});

test("changing one filter preserves the others (the dropdowns' update path)", () => {
  // <ShopView>.updateQuery spreads the current query and overrides one key.
  const current = queryFromUrl("/shop?category=gaming&price=25-100&q=mouse&sort=rating&page=2");

  const afterSort: ShopQuery = { ...current, page: 1, sort: "price-asc" };
  assert.equal(afterSort.category, "gaming", "sorting must not reset the category");
  assert.equal(afterSort.price, "25-100");
  assert.equal(afterSort.q, "mouse");

  const afterPrice: ShopQuery = { ...current, page: 1, price: "over-500" };
  assert.equal(afterPrice.category, "gaming", "price must not reset the category");
  assert.equal(afterPrice.sort, "rating");

  const afterCategory: ShopQuery = { ...current, page: 1, category: "beauty" };
  assert.equal(afterCategory.price, "25-100", "category change keeps the price filter");
  assert.equal(afterCategory.sort, "rating", "category change keeps the sort");
  assert.equal(afterCategory.q, "mouse", "category change keeps the search");

  // Any filter change returns to page 1.
  for (const next of [afterSort, afterPrice, afterCategory]) assert.equal(next.page, 1);
});

test("malformed filter values degrade to defaults instead of breaking the grid", () => {
  const query = queryFromUrl("/shop?category=%20&price=free&sort=cheapest&page=-4");
  assert.deepEqual(query, {
    category: ALL_CATEGORIES,
    q: "",
    price: "all",
    sort: DEFAULT_SHOP_SORT,
    page: 1,
  });
  assert.equal(selectShopProducts(products, query).length, buyerVisible.length);
});

/* -------------------------------------------------------------------------- */
/*  7. Pagination                                                             */
/* -------------------------------------------------------------------------- */

test("pagination stays inside the filtered category", () => {
  const page1 = selectShopPage(products, queryFromUrl("/shop?category=electronics"));
  assert.equal(page1.page, 1);
  assert.ok(page1.total > 0);
  for (const product of page1.items) assert.equal(product.categoryId, "electronics");

  // An out-of-range page clamps rather than rendering an empty grid.
  const far = selectShopPage(products, queryFromUrl("/shop?category=electronics&page=99"));
  assert.equal(far.page, far.pageCount);
  assert.ok(far.items.length > 0);
  for (const product of far.items) assert.equal(product.categoryId, "electronics");
});

test("paging the full catalog never exceeds the page size and covers everything", () => {
  const seen: string[] = [];
  const first = selectShopPage(products, queryFromUrl("/shop"));
  for (let page = 1; page <= first.pageCount; page += 1) {
    const slice = selectShopPage(products, queryFromUrl(`/shop?page=${page}`));
    assert.ok(slice.items.length <= SHOP_PAGE_SIZE);
    seen.push(...slice.items.map((p) => p.id));
  }
  assert.equal(seen.length, buyerVisible.length);
  assert.equal(new Set(seen).size, seen.length, "a product appeared on two pages");
});

/* -------------------------------------------------------------------------- */
/*  8. Buyer visibility                                                       */
/* -------------------------------------------------------------------------- */

test("only purchasable products reach the storefront, in every category", () => {
  for (const category of CATEGORIES) {
    for (const product of productsFor(`/shop?category=${category.id}`)) {
      assert.equal(product.status, "Active", `${product.name} should not be on sale`);
    }
  }
});
