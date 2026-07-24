"use client";

import { RecentOrdersTable } from "@/components/tables/recent-orders-table";
import { useOrders } from "@/lib/store/orders-store";

export function DashboardRecentOrders() {
  const { orders } = useOrders();
  const recent = [...orders]
    .sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date))
    .slice(0, 6);

  return <RecentOrdersTable orders={recent} />;
}
