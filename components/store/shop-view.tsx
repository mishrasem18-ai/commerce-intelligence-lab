"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import {
  BuyerProductCard,
  BUYER_GRID_CLASS,
} from "@/components/store/buyer-product-card";
import { useProducts } from "@/lib/store/products-store";
import { buyerProducts } from "@/lib/commerce";
import { PRICE_BUCKETS, PRODUCT_CATEGORIES, type Product } from "@/lib/data/products";
import { formatNumber } from "@/lib/utils";

const PAGE_SIZE = 24;

type SortKey = "featured" | "price-asc" | "price-desc" | "rating" | "popularity";

const SORT_OPTIONS: SelectOption[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Rating" },
  { value: "popularity", label: "Popularity" },
];

const categoryOptions: SelectOption[] = [
  { value: "all", label: "All categories" },
  ...PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c })),
];

const priceOptions: SelectOption[] = [
  { value: "all", label: "Any price" },
  ...PRICE_BUCKETS.map((b) => ({ value: b.id, label: b.label })),
];

const SORTERS: Record<SortKey, (a: Product, b: Product) => number> = {
  featured: (a, b) => b.rating - a.rating || b.unitsSold - a.unitsSold,
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating,
  popularity: (a, b) => b.unitsSold - a.unitsSold,
};

export function ShopView({
  initialCategory = "all",
  initialQuery = "",
}: {
  initialCategory?: string;
  initialQuery?: string;
}) {
  const { products } = useProducts();
  const [query, setQuery] = React.useState(initialQuery);
  const [category, setCategory] = React.useState(initialCategory);
  const [price, setPrice] = React.useState("all");
  const [sort, setSort] = React.useState<SortKey>("featured");
  const [page, setPage] = React.useState(1);

  const resetPage = () => setPage(1);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const bucket = PRICE_BUCKETS.find((b) => b.id === price);
    const result = buyerProducts(products).filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      const matchesCategory = category === "all" || p.category === category;
      const matchesPrice = !bucket || (p.price >= bucket.min && p.price < bucket.max);
      return matchesQuery && matchesCategory && matchesPrice;
    });
    return result.sort(SORTERS[sort]);
  }, [products, query, category, price, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPage();
            }}
            placeholder="Search products…"
            aria-label="Search products"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            label="Category"
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              resetPage();
            }}
            options={categoryOptions}
            className="w-40"
          />
          <Select
            label="Price"
            value={price}
            onValueChange={(v) => {
              setPrice(v);
              resetPage();
            }}
            options={priceOptions}
            className="w-36"
          />
          <Select
            label="Sort"
            value={sort}
            onValueChange={(v) => {
              setSort(v as SortKey);
              resetPage();
            }}
            options={SORT_OPTIONS}
            align="end"
            className="w-48"
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {formatNumber(filtered.length)} {filtered.length === 1 ? "product" : "products"}
      </p>

      {pageItems.length > 0 ? (
        <div className={BUYER_GRID_CLASS}>
          {pageItems.map((product) => (
            <BuyerProductCard key={product.id} product={product} />
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

      {filtered.length > PAGE_SIZE && (
        <div className="flex justify-center pt-2">
          <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
