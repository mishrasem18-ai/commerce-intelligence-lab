import { CalendarDays, Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { ChartCard } from "@/components/charts/chart-card";
import { RevenueTrendChart } from "@/components/charts/revenue-trend-chart";
import { OrdersByMonthChart } from "@/components/charts/orders-by-month-chart";
import { TrafficSourcesChart } from "@/components/charts/traffic-sources-chart";
import { CountryRevenueChart } from "@/components/charts/country-revenue-chart";
import { RightPanel } from "@/components/dashboard/right-panel";
import { RecentOrdersTable } from "@/components/tables/recent-orders-table";
import { TopProductsList } from "@/components/dashboard/top-products-list";
import { orders, products } from "@/lib/data";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Welcome back — here's how your store is performing this month."
        actions={
          <>
            <Button variant="outline" size="md">
              <CalendarDays />
              Last 30 days
            </Button>
            <Button variant="outline" size="md">
              <Download />
              Export
            </Button>
            <Button size="md">
              <Plus />
              New Report
            </Button>
          </>
        }
      />

      <KpiGrid />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <ChartCard
            title="Revenue Trend"
            description="Monthly revenue over the last 12 months"
            height={300}
            action={<Badge variant="success">+12.4%</Badge>}
          >
            <RevenueTrendChart />
          </ChartCard>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ChartCard
              title="Orders by Month"
              description="Order volume trend"
              height={240}
            >
              <OrdersByMonthChart />
            </ChartCard>
            <ChartCard
              title="Traffic Sources"
              description="Where your visitors come from"
              bodyClassName="pt-2"
            >
              <TrafficSourcesChart />
            </ChartCard>
          </div>
        </div>

        <div className="xl:col-span-1">
          <RightPanel />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary">
              View all orders
            </Button>
          </CardHeader>
          <CardContent>
            <RecentOrdersTable orders={orders.slice(0, 6)} />
          </CardContent>
        </Card>

        <ChartCard
          title="Revenue by Country"
          description="Top markets this month"
          className="xl:col-span-1"
        >
          <CountryRevenueChart />
        </ChartCard>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Top Products</CardTitle>
          <Button variant="ghost" size="sm" className="text-primary">
            View catalog
          </Button>
        </CardHeader>
        <CardContent>
          <TopProductsList products={products.slice(0, 6)} />
        </CardContent>
      </Card>
    </div>
  );
}
