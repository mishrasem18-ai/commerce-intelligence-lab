/**
 * Canonical product categories — the single source of truth for category
 * identity across the storefront, the admin and the D1 data layer.
 *
 * Every category has a stable **slug id** (`"gaming"`) and a **display name**
 * (`"Gaming"`). The slug is the identity used for matching and for URLs; the
 * display name is presentation only. Matching never compares display strings,
 * which is what previously allowed "Gaming" in the URL to sit next to an
 * Electronics product grid.
 *
 * The ids and the ORDER below mirror the `categories` table in D1 exactly
 * (`migrations/0002_seed.sql`, ordered by rowid). The order is load-bearing:
 * the deterministic demo catalog assigns categories by `index % length`, so
 * reordering would re-categorise every generated product. `lib/catalog/
 * categories.test.ts` pins both the ids and the order against the migration.
 *
 * This module is runtime-agnostic (no `server-only`, no React, no DOM) so the
 * server page, the client components and the Node test runner all share it.
 */

export interface CategoryDefinition {
  /** Stable slug — matches `categories.id` in D1. */
  id: CategoryId;
  /** Human-facing label — matches `categories.name` in D1. */
  name: ProductCategory;
}

export const CATEGORIES = [
  { id: "electronics", name: "Electronics" },
  { id: "fashion", name: "Fashion" },
  { id: "home", name: "Home" },
  { id: "sports", name: "Sports" },
  { id: "books", name: "Books" },
  { id: "beauty", name: "Beauty" },
  { id: "furniture", name: "Furniture" },
  { id: "accessories", name: "Accessories" },
  { id: "gaming", name: "Gaming" },
  { id: "toys", name: "Toys" },
] as const satisfies readonly { id: string; name: string }[];

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export type ProductCategory = (typeof CATEGORIES)[number]["name"];

/** Display names, in canonical order. Kept for the many `ProductCategory` UIs. */
export const PRODUCT_CATEGORIES = CATEGORIES.map((c) => c.name) as unknown as readonly [
  ProductCategory,
  ...ProductCategory[],
];

/** Category ids, in canonical order. */
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as readonly CategoryId[];

/**
 * The sentinel for "no category filter". Deliberately not a `CategoryId`, so
 * the type system forbids confusing it with a real category.
 */
export const ALL_CATEGORIES = "all";
export type CategorySelection = CategoryId | typeof ALL_CATEGORIES;

const BY_ID = new Map<string, CategoryDefinition>(
  CATEGORIES.map((c) => [c.id, c as CategoryDefinition]),
);
/** Lookup by lowercased display name, so `?category=gaming` also resolves. */
const BY_NAME = new Map<string, CategoryDefinition>(
  CATEGORIES.map((c) => [c.name.toLowerCase(), c as CategoryDefinition]),
);

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && BY_ID.has(value);
}

/** The display name for a category id (`"gaming"` → `"Gaming"`). */
export function categoryName(id: CategoryId): ProductCategory {
  return BY_ID.get(id)!.name;
}

/** The canonical id for a display name (`"Gaming"` → `"gaming"`), else null. */
export function categoryIdFromName(name: string): CategoryId | null {
  return BY_NAME.get(name.trim().toLowerCase())?.id ?? null;
}

/**
 * Resolve an untrusted category parameter (URL query, D1 column, form value)
 * to a canonical selection.
 *
 * Accepts the canonical slug (`"gaming"`) *and* the display name (`"Gaming"`),
 * case-insensitively, so links minted before slugs existed — and the
 * `?category=Gaming` URLs already out in the wild — keep working. Anything
 * unrecognised resolves to `"all"` rather than silently producing an empty or
 * mismatched grid.
 */
export function resolveCategory(raw: string | null | undefined): CategorySelection {
  if (!raw) return ALL_CATEGORIES;
  const key = raw.trim().toLowerCase();
  if (!key || key === ALL_CATEGORIES) return ALL_CATEGORIES;
  return BY_ID.get(key)?.id ?? BY_NAME.get(key)?.id ?? ALL_CATEGORIES;
}

/** Heading text for a selection ("All Products" when unfiltered). */
export function categorySelectionLabel(selection: CategorySelection): string {
  return selection === ALL_CATEGORIES ? "All Products" : categoryName(selection);
}

/**
 * The two category fields carried on a Product, derived from one input so the
 * canonical id and the display name can never drift apart. Used everywhere a
 * product is created or its category edited.
 */
export function categoryFields(nameOrId: string): {
  category: ProductCategory;
  categoryId: CategoryId;
} {
  const selection = resolveCategory(nameOrId);
  const id = selection === ALL_CATEGORIES ? CATEGORIES[0].id : selection;
  return { category: categoryName(id), categoryId: id };
}

/**
 * Categories surfaced in the storefront's primary navigation bar. A subset of
 * the catalog (the merchandising picks); every category remains reachable via
 * the shop's category dropdown, the mobile drawer and the home page grid.
 */
export const PRIMARY_NAV_CATEGORY_IDS = [
  "electronics",
  "fashion",
  "home",
  "gaming",
  "beauty",
  "sports",
] as const satisfies readonly CategoryId[];

export const PRIMARY_NAV_CATEGORIES: readonly CategoryDefinition[] =
  PRIMARY_NAV_CATEGORY_IDS.map((id) => BY_ID.get(id)!);

/** Categories not in the primary nav, in canonical order. */
export const SECONDARY_NAV_CATEGORIES: readonly CategoryDefinition[] = CATEGORIES.filter(
  (c) => !(PRIMARY_NAV_CATEGORY_IDS as readonly string[]).includes(c.id),
) as unknown as readonly CategoryDefinition[];
