import { PageHeader } from "@/components/layout/page-header";
import {
  ProductsExplorerSkeleton,
  ProductStatsSkeleton,
} from "@/components/products/products-skeleton";

export default function ProductsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        description="Manage your catalog, track performance and monitor inventory."
      />
      <ProductStatsSkeleton />
      <ProductsExplorerSkeleton />
    </div>
  );
}
