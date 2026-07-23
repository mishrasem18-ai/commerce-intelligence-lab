import type { Metadata } from "next";
import { Boxes, Download, PackageX, Plus, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/cards/stat-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductsTable } from "@/components/tables/products-table";
import { products } from "@/lib/data";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);
  const totalUnits = products.reduce((sum, p) => sum + p.unitsSold, 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock < 50).length;
  const outOfStock = products.filter((p) => p.stock === 0).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        description="Manage your catalog, track performance and monitor inventory."
        actions={
          <>
            <Button variant="outline">
              <Download />
              Export
            </Button>
            <Button>
              <Plus />
              Add Product
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Products"
          value={formatNumber(products.length)}
          icon={Boxes}
          hint="Across 5 categories"
        />
        <StatCard
          label="Units Sold"
          value={formatNumber(totalUnits)}
          icon={TrendingUp}
          delta="+8.6%"
          direction="up"
        />
        <StatCard
          label="Catalog Revenue"
          value={formatCurrency(totalRevenue)}
          icon={TrendingUp}
          delta="+12.4%"
          direction="up"
        />
        <StatCard
          label="Needs Attention"
          value={`${lowStock + outOfStock}`}
          icon={PackageX}
          hint={`${outOfStock} out of stock · ${lowStock} low`}
        />
      </div>

      <Card>
        <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>All Products</CardTitle>
          <div className="w-full sm:max-w-xs">
            <Input placeholder="Search products…" />
          </div>
        </CardHeader>
        <CardContent>
          <ProductsTable products={products} />
        </CardContent>
      </Card>
    </div>
  );
}
