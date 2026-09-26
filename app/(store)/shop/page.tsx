import { Suspense } from "react";
import type { Metadata } from "next";
import { routeMetadata } from "@/lib/routes/page-titles";
import { ShopView } from "@/components/store/shop-view";
import { categorySelectionLabel } from "@/lib/catalog/categories";
import { parseShopQuery } from "@/lib/catalog/shop-query";

export const metadata: Metadata = routeMetadata("shop");

/**
 * The shop's state lives entirely in the URL. This server component and the
 * client `<ShopView>` both derive it with the same `parseShopQuery`, so the
 * heading below and the grid inside can never describe different categories.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseShopQuery(await searchParams);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {categorySelectionLabel(query.category)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover our full range of products.
        </p>
      </div>
      {/* ShopView reads the query string via useSearchParams. */}
      <Suspense fallback={null}>
        <ShopView />
      </Suspense>
    </div>
  );
}
