import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProductStats } from "@/components/products/product-stats";
import { ProductsExplorer } from "@/components/products/products-explorer";
import { ProductsHeaderActions } from "@/components/products/products-header-actions";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        description="Manage your catalog, track performance and monitor inventory."
        actions={<ProductsHeaderActions />}
      />

      <ProductStats />
      <ProductsExplorer />
    </div>
  );
}
