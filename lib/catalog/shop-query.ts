/**
 * The storefront's shop query — parsing, serialising and applying it.
 *
 * ARCHITECTURE: the URL is the single source of truth for the shop's view
 * state (category, search, price bucket, sort, page). Nothing keeps a private
 * copy. The server page and the client `<ShopView>` both derive their state by
 * running `parseShopQuery` over the *same* URL, so the heading, the navigation
 * highlight, the filter dropdowns and the product grid cannot disagree.
 *
 * Everything here is pure: no React, no DOM, no `server-only`. That is what
 * lets `shop-query.test.ts` exercise the exact code the browser runs.
 */

import type { Product } from "@/lib/data/products";
import { isPurchasable } from "@/lib/commerce";
import {
  ALL_CATEGORIES,
  categoryName,
  resolveCategory,
  type CategorySelection,
} from "@/lib/catalog/categories";

/* -------------------------------------------------------------------------- */
/*  Price buckets                                                             */
/* -------------------------------------------------------------------------- */

export interface PriceBucket {
  id: string;
  label: string;
  min: number;
  /** Exclusive upper bound. */
  max: number;
}

export const PRICE_BUCKETS: PriceBucket[] = [
  { id: "under-25", label: "Under $25", min: 0, max: 25 },
  { id: "25-100", label: "$25 – $100", min: 25, max: 100 },
  { id: "100-250", label: "$100 – $250", min: 100, max: 250 },
  { id: "250-500", label: "$250 – $500", min: 250, max: 500 },
  { id: "over-500", label: "Over $500", min: 500, max: Infinity },
];

export const ALL_PRICES = "all";
export type PriceSelection = string;

/* -------------------------------------------------------------------------- */
/*  Sorting                                                                   */
/* -------------------------------------------------------------------------- */

export const SHOP_SORT_KEYS = [
  "featured",
  "price-asc",
  "price-desc",
  "rating",
  "popularity",
] as const;

export type ShopSortKey = (typeof SHOP_SORT_KEYS)[number];

export const DEFAULT_SHOP_SORT: ShopSortKey = "featured";

export const SHOP_SORT_LABELS: Record<ShopSortKey, string> = {
  featured: "Featured",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  rating: "Rating",
  popularity: "Popularity",
};

/**
 * Comparators. Each falls through to `id` so equal-ranking products keep a
 * stable, deterministic order (identical on the server and after hydration).
 */
const SORTERS: Record<ShopSortKey, (a: Product, b: Product) => number> = {
  featured: (a, b) => b.rating - a.rating || b.unitsSold - a.unitsSold || cmpId(a, b),
  "price-asc": (a, b) => a.price - b.price || cmpId(a, b),
  "price-desc": (a, b) => b.price - a.price || cmpId(a, b),
  rating: (a, b) => b.rating - a.rating || cmpId(a, b),
  popularity: (a, b) => b.unitsSold - a.unitsSold || cmpId(a, b),
};

function cmpId(a: Product, b: Product): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function isShopSortKey(value: unknown): value is ShopSortKey {
  return (SHOP_SORT_KEYS as readonly unknown[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/*  The query                                                                 */
/* -------------------------------------------------------------------------- */

export const SHOP_PAGE_SIZE = 24;

export interface ShopQuery {
  category: CategorySelection;
  /** Free-text search, already trimmed. */
  q: string;
  /** A `PRICE_BUCKETS` id, or `"all"`. */
  price: PriceSelection;
  sort: ShopSortKey;
  /** 1-based. */
  page: number;
}

export const DEFAULT_SHOP_QUERY: ShopQuery = {
  category: ALL_CATEGORIES,
  q: "",
  price: ALL_PRICES,
  sort: DEFAULT_SHOP_SORT,
  page: 1,
};

/**
 * Anything a URL's query string can arrive as: `URLSearchParams`, Next's
 * `ReadonlyURLSearchParams` (client), or the awaited `searchParams` object of a
 * server page.
 */
export type ShopParamSource =
  | URLSearchParams
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

function readParam(source: ShopParamSource, key: string): string | null {
  if (!source) return null;
  if (typeof (source as { get?: unknown }).get === "function") {
    return (source as { get(name: string): string | null }).get(key);
  }
  const value = (source as Record<string, string | string[] | undefined>)[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function resolvePrice(raw: string | null): PriceSelection {
  if (!raw) return ALL_PRICES;
  const key = raw.trim().toLowerCase();
  return PRICE_BUCKETS.some((bucket) => bucket.id === key) ? key : ALL_PRICES;
}

function resolveSort(raw: string | null): ShopSortKey {
  if (!raw) return DEFAULT_SHOP_SORT;
  const key = raw.trim().toLowerCase();
  return isShopSortKey(key) ? key : DEFAULT_SHOP_SORT;
}

function resolvePage(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * URL → canonical shop query. Total: every unrecognised or malformed value
 * falls back to its default, so a hand-typed URL can never leave the UI in a
 * state the filters cannot represent.
 */
export function parseShopQuery(source: ShopParamSource): ShopQuery {
  return {
    category: resolveCategory(readParam(source, "category")),
    q: (readParam(source, "q") ?? "").trim(),
    price: resolvePrice(readParam(source, "price")),
    sort: resolveSort(readParam(source, "sort")),
    page: resolvePage(readParam(source, "page")),
  };
}

/**
 * Canonical shop query → query string. Defaults are omitted, so the unfiltered
 * shop is plain `/shop` and every distinct view has exactly one URL.
 * The category is always written as its **slug**.
 */
export function buildShopParams(query: Partial<ShopQuery>): URLSearchParams {
  const merged = { ...DEFAULT_SHOP_QUERY, ...query };
  const params = new URLSearchParams();
  if (merged.category !== ALL_CATEGORIES) params.set("category", merged.category);
  if (merged.price !== ALL_PRICES) params.set("price", merged.price);
  if (merged.sort !== DEFAULT_SHOP_SORT) params.set("sort", merged.sort);
  const q = merged.q.trim();
  if (q) params.set("q", q);
  if (merged.page > 1) params.set("page", String(merged.page));
  return params;
}

export const SHOP_PATH = "/shop";

export function shopHref(query: Partial<ShopQuery>): string {
  const qs = buildShopParams(query).toString();
  return qs ? `${SHOP_PATH}?${qs}` : SHOP_PATH;
}

/**
 * Href for a category entry in the site navigation. Navigation is a *fresh
 * browse* into a category: it deliberately carries no search/price/sort, so the
 * link is a stable, shareable URL for "the Gaming catalog". In-page controls
 * (the category dropdown) preserve the other filters instead — see `ShopView`.
 */
export function categoryHref(category: CategorySelection): string {
  return shopHref({ category });
}

/* -------------------------------------------------------------------------- */
/*  Applying the query                                                        */
/* -------------------------------------------------------------------------- */

/** Category match is an id comparison — never a display-string comparison. */
export function matchesCategory(product: Product, category: CategorySelection): boolean {
  return category === ALL_CATEGORIES || product.categoryId === category;
}

export function matchesPrice(product: Product, price: PriceSelection): boolean {
  const bucket = PRICE_BUCKETS.find((b) => b.id === price);
  if (!bucket) return true;
  return product.price >= bucket.min && product.price < bucket.max;
}

export function matchesSearch(product: Product, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    product.name.toLowerCase().includes(needle) ||
    product.brand.toLowerCase().includes(needle) ||
    categoryName(product.categoryId).toLowerCase().includes(needle)
  );
}

/**
 * The whole storefront selection in one place: buyer-visible products, then
 * category + search + price (all independent — none resets another), then sort.
 *
 * Sorting is applied to the already-filtered set and returns a new array, so
 * changing the sort can never widen or replace the filtered dataset.
 */
export function selectShopProducts(products: Product[], query: ShopQuery): Product[] {
  const filtered = products.filter(
    (product) =>
      isPurchasable(product) &&
      matchesCategory(product, query.category) &&
      matchesSearch(product, query.q) &&
      matchesPrice(product, query.price),
  );
  return filtered.sort(SORTERS[query.sort]);
}

export interface ShopPage {
  items: Product[];
  /** Size of the full filtered set (not just this page). */
  total: number;
  /** The page actually shown — clamped into range. */
  page: number;
  pageCount: number;
}

export function paginateShopProducts(
  products: Product[],
  page: number,
  pageSize: number = SHOP_PAGE_SIZE,
): ShopPage {
  const total = products.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  return {
    items: products.slice((safePage - 1) * pageSize, safePage * pageSize),
    total,
    page: safePage,
    pageCount,
  };
}

/** Convenience: URL query → the exact page of products the grid renders. */
export function selectShopPage(
  products: Product[],
  query: ShopQuery,
  pageSize: number = SHOP_PAGE_SIZE,
): ShopPage {
  return paginateShopProducts(selectShopProducts(products, query), query.page, pageSize);
}
