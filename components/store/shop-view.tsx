"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import {
  BuyerProductCard,
  BUYER_GRID_CLASS,
} from "@/components/store/buyer-product-card";
import { useProducts } from "@/lib/store/products-store";
import { analytics } from "@/lib/analytics";
import { listCommerce } from "@/lib/analytics/tracking";
import {
  ALL_CATEGORIES,
  CATEGORIES,
  categorySelectionLabel,
} from "@/lib/catalog/categories";
import {
  ALL_PRICES,
  buildShopParams,
  parseShopQuery,
  PRICE_BUCKETS,
  selectShopPage,
  SHOP_PAGE_SIZE,
  SHOP_SORT_KEYS,
  SHOP_SORT_LABELS,
  type ShopQuery,
} from "@/lib/catalog/shop-query";
import { formatNumber } from "@/lib/utils";

const categoryOptions: SelectOption[] = [
  { value: ALL_CATEGORIES, label: "All categories" },
  ...CATEGORIES.map((c) => ({ value: c.id, label: c.name })),
];

const priceOptions: SelectOption[] = [
  { value: ALL_PRICES, label: "Any price" },
  ...PRICE_BUCKETS.map((b) => ({ value: b.id, label: b.label })),
];

const sortOptions: SelectOption[] = SHOP_SORT_KEYS.map((key) => ({
  value: key,
  label: SHOP_SORT_LABELS[key],
}));

/**
 * The storefront catalog.
 *
 * There is exactly ONE piece of view state — the URL. Category, search, price,
 * sort and page are all derived from `useSearchParams()` on every render, and
 * every control writes back to the URL. Nothing is mirrored into `useState`.
 *
 * That is the fix for the category desync bug: this component previously seeded
 * `useState` from a server-rendered `initialCategory` prop. Because a shop→shop
 * navigation only changes the query string, React reused the same component
 * instance and the state initialiser never re-ran — so the server-rendered
 * heading said "Gaming" while the client's stale state still filtered (and
 * displayed in the dropdown) "Electronics". With the URL as the single source,
 * heading, navigation highlight, dropdowns and grid are the same value by
 * construction, on desktop and mobile alike.
 *
 * The one exception is the search box's *text*, which needs to echo keystrokes
 * instantly; it is re-synced from the URL whenever the URL's `q` changes, so it
 * can never disagree either (see `queryDraft` below).
 */
export function ShopView() {
  const { products } = useProducts();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // THE source of truth. Re-parsed on every render, including after a
  // client-side navigation from the header's category links.
  const query = React.useMemo(() => parseShopQuery(searchParams), [searchParams]);

  // Local echo of the search text so typing stays responsive. Reset whenever
  // the URL's `q` changes (React's "adjust state when a prop changes" pattern),
  // which covers back/forward, a category link, and the header search box.
  const [queryDraft, setQueryDraft] = React.useState(query.q);
  const [lastUrlQuery, setLastUrlQuery] = React.useState(query.q);
  if (query.q !== lastUrlQuery) {
    setLastUrlQuery(query.q);
    setQueryDraft(query.q);
  }

  /**
   * Write a patch of the query back to the URL. Every filter change preserves
   * the other filters — changing sort or price never clears the category, and
   * changing the category keeps the current search/price/sort. Any filter
   * change returns to page 1 unless the patch sets a page explicitly.
   */
  const updateQuery = React.useCallback(
    (patch: Partial<ShopQuery>) => {
      const next: ShopQuery = { ...query, page: 1, ...patch };
      const qs = buildShopParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [query, pathname, router],
  );

  const { items, total, page, pageCount } = React.useMemo(
    () => selectShopPage(products, query),
    [products, query],
  );

  // Canonical view_item_list + search.submit. Debounced because typing in the
  // search box rewrites the URL per keystroke; only the settled state counts.
  // Refs dedupe repeats (and Strict Mode double effects); a remount after
  // navigating away and back deliberately counts as a fresh list view.
  const lastListKey = React.useRef<string | null>(null);
  const lastSearchTerm = React.useRef<string | null>(null);
  React.useEffect(() => {
    const listKey = [query.category, query.price, query.sort, query.page, query.q].join("|");
    const timer = window.setTimeout(() => {
      if (listKey !== lastListKey.current) {
        lastListKey.current = listKey;
        analytics.track("commerce.view_item_list", {
          commerce: listCommerce(items, categorySelectionLabel(query.category)),
        });
      }
      const term = query.q.trim();
      if (term && term !== lastSearchTerm.current) {
        lastSearchTerm.current = term;
        analytics.track("search.submit", {
          search: { query: term, results_count: total },
        });
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [query, items, total]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={queryDraft}
            onChange={(e) => {
              setQueryDraft(e.target.value);
              updateQuery({ q: e.target.value });
            }}
            placeholder="Search products…"
            aria-label="Search products"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label="Category"
            value={query.category}
            onValueChange={(value) => updateQuery({ category: parseCategory(value) })}
            options={categoryOptions}
            className="w-40"
          />
          <Select
            label="Price"
            value={query.price}
            onValueChange={(value) => updateQuery({ price: value })}
            options={priceOptions}
            className="w-36"
          />
          <Select
            label="Sort"
            value={query.sort}
            onValueChange={(value) => updateQuery({ sort: parseSort(value) })}
            options={sortOptions}
            align="end"
            className="w-48"
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {formatNumber(total)} {total === 1 ? "product" : "products"}
      </p>

      {items.length > 0 ? (
        <div className={BUYER_GRID_CLASS}>
          {items.map((product) => (
            <BuyerProductCard
              key={product.id}
              product={product}
              listName={categorySelectionLabel(query.category)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <p className="text-sm font-medium text-foreground">No products found</p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search or filters.
          </p>
        </div>
      )}

      {total > SHOP_PAGE_SIZE && (
        <div className="flex justify-center pt-2">
          <Pagination
            page={page}
            pageCount={pageCount}
            onPageChange={(next) => updateQuery({ page: next })}
          />
        </div>
      )}
    </div>
  );
}

// The Select is a plain string control; re-parse its value through the same
// resolvers the URL uses so an unexpected value can't enter the query.
function parseCategory(value: string): ShopQuery["category"] {
  return parseShopQuery({ category: value }).category;
}

function parseSort(value: string): ShopQuery["sort"] {
  return parseShopQuery({ sort: value }).sort;
}
