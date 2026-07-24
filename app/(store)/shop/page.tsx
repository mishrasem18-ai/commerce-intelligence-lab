import type { Metadata } from "next";
import { ShopView } from "@/components/store/shop-view";
import { PRODUCT_CATEGORIES } from "@/lib/data/products";

export const metadata: Metadata = { title: { absolute: "Shop · Aurora Market" } };

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const validCategory =
    category && (PRODUCT_CATEGORIES as readonly string[]).includes(category)
      ? category
      : "all";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {validCategory === "all" ? "All Products" : validCategory}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover our full range of products.
        </p>
      </div>
      <ShopView initialCategory={validCategory} initialQuery={q ?? ""} />
    </div>
  );
}
