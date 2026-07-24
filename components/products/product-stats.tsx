"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Package,
  PackageX,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/components/cards/stat-card";
import { useProducts } from "@/lib/store/products-store";
import { getProductStats, LOW_STOCK_THRESHOLD, PRODUCT_CATEGORIES } from "@/lib/data/products";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export function ProductStats() {
  const { products } = useProducts();
  const stats = getProductStats(products);
  const activeShare = stats.total > 0 ? stats.active / stats.total : 0;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <StatCard
        label="Total Products"
        value={formatNumber(stats.total)}
        icon={Package}
        hint={`Across ${PRODUCT_CATEGORIES.length} categories`}
      />
      <StatCard
        label="Active Products"
        value={formatNumber(stats.active)}
        icon={CheckCircle2}
        hint={`${formatPercent(activeShare)} of catalog`}
      />
      <StatCard
        label="Low Stock"
        value={formatNumber(stats.lowStock)}
        icon={AlertTriangle}
        hint={`≤ ${LOW_STOCK_THRESHOLD} units left`}
      />
      <StatCard
        label="Out of Stock"
        value={formatNumber(stats.outOfStock)}
        icon={PackageX}
        hint="Needs restocking"
      />
      <StatCard
        label="Catalog Revenue"
        value={formatCurrency(stats.revenue)}
        icon={Wallet}
        hint={`${formatNumber(stats.unitsSold)} units sold`}
      />
    </div>
  );
}
