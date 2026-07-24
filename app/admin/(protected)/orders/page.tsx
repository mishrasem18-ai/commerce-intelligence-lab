import type { Metadata } from "next";
import { Receipt, RotateCcw, ShoppingCart, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/cards/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { OrdersView } from "@/components/tables/orders-view";
import { OrdersHeaderActions } from "@/components/orders/orders-header-actions";
import { getOrders } from "@/lib/db/orders";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await getOrders();
  const revenue = orders.reduce((sum, o) => sum + o.amount, 0);
  const aov = revenue / orders.length;
  const refunds = orders.filter((o) => o.status === "Refunded").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Orders"
        description="Track, filter and manage every order across your storefront."
        actions={<OrdersHeaderActions />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Orders"
          value={formatNumber(3248)}
          icon={ShoppingCart}
          delta="+8.6%"
          direction="up"
        />
        <StatCard
          label="Order Revenue"
          value={formatCurrency(128450)}
          icon={Wallet}
          delta="+12.4%"
          direction="up"
        />
        <StatCard
          label="Avg. Order Value"
          value={formatCurrency(aov, { maximumFractionDigits: 2 })}
          icon={Receipt}
          delta="+3.1%"
          direction="up"
        />
        <StatCard
          label="Refunds"
          value={formatNumber(refunds)}
          icon={RotateCcw}
          delta="-0.4%"
          direction="down"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <OrdersView />
        </CardContent>
      </Card>
    </div>
  );
}
