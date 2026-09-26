"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { ProductImage } from "@/components/products/product-image";
import { useProducts } from "@/lib/store/products-store";
import { buyerProducts } from "@/lib/commerce";
import {
  matchesSearch,
  parseShopQuery,
  selectShopProducts,
  shopHref,
} from "@/lib/catalog/shop-query";
import { searchTracker } from "@/lib/analytics";
import { cn, formatCurrency } from "@/lib/utils";

/** Public search — buyer-visible products only. Never exposes admin entities. */
export function StoreSearch({
  className,
  onNavigate,
  autoFocus,
}: {
  className?: string;
  onNavigate?: () => void;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const { products } = useProducts();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  // Same matcher the shop grid uses, so these suggestions and the results page
  // can never disagree about what a query matches.
  const results = React.useMemo(() => {
    if (!query.trim()) return [];
    return buyerProducts(products)
      .filter((p) => matchesSearch(p, query))
      .slice(0, 6);
  }, [query, products]);

  // How many products the results page will list for this term — the same
  // selection /shop runs for shopHref({ q }), so search_results_count always
  // matches what the shopper sees there.
  const resultsCount = () => selectShopProducts(products, parseShopQuery({ q: query })).length;

  // A header search is a store-wide search: it deliberately starts a fresh
  // shop query rather than narrowing whatever category is on screen. The
  // canonical search.submit fires here, before navigating; /shop never
  // re-fires for a client-side arrival (see lib/analytics/search.ts).
  const goToShop = () => {
    searchTracker.submit(query, resultsCount(), "header");
    setOpen(false);
    onNavigate?.();
    router.push(shopHref({ q: query }));
  };

  // Choosing a suggestion is its own signal (search_source "suggestion"),
  // never an extra plain submit.
  const openProduct = (id: string) => {
    searchTracker.submit(query, resultsCount(), "suggestion");
    setOpen(false);
    setQuery("");
    onNavigate?.();
    router.push(`/product/${id}`);
  };

  return (
    <div className={cn("relative", className)} ref={ref}>
      {/* A real search form: Enter and the mobile keyboard's "Search"/"Go"
          key both arrive as one submit event. Typing emits nothing. */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          goToShop();
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          enterKeyHint="search"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search products…"
          aria-label="Search products"
          className="h-10 w-full rounded-full border border-input bg-muted/50 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/20"
        />
      </form>

      {open && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-lg shadow-black/10 animate-pop">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No products match “{query.trim()}”
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openProduct(p.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent/60"
                >
                  <ProductImage
                    src={p.image}
                    usage="thumb40"
                    alt={p.name}
                    category={p.category}
                    className="size-10 shrink-0 rounded-lg"
                    iconSize={16}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.brand}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(p.price, { maximumFractionDigits: 2 })}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={goToShop}
                className="mt-1 w-full rounded-xl px-3 py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-accent/60"
              >
                See all results
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
