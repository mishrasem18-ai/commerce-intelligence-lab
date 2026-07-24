"use client";

import { PackageX, ShoppingCart, Users, Wallet } from "lucide-react";
import { StatCard } from "@/components/cards/stat-card";
import { useOrders } from "@/lib/store/orders-store";
import { useCustomers } from "@/lib/store/customers-store";
import { useProducts } from "@/lib/store/products-store";
import { getProductStats } from "@/lib/data/products";
import { formatCurrency, formatNumber } from "@/lib/utils";

/** Live commerce metrics derived from the shared stores (reflects buyer activity). */
export function LiveMetrics() {
  const { orders } = useOrders();
  const { customers } = useCustomers();
  const { products } = useProducts();

  const revenue = orders.reduce((sum, o) => sum + o.amount, 0);
  const stats = getProductStats(products);

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Live commerce state
      </p>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Orders in system"
          value={formatNumber(orders.length)}
          icon={ShoppingCart}
          hint="Includes new buyer orders"
        />
        <StatCard
          label="Order revenue"
          value={formatCurrency(revenue)}
          icon={Wallet}
          hint="Sum of all orders"
        />
        <StatCard
          label="Customers"
          value={formatNumber(customers.length)}
          icon={Users}
          hint="Includes new signups"
        />
        <StatCard
          label="Low / out of stock"
          value={formatNumber(stats.lowStock + stats.outOfStock)}
          icon={PackageX}
          hint={`${stats.outOfStock} out of stock`}
        />
      </div>
    </div>
  );
}
