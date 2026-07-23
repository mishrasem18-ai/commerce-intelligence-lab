import type { Metadata } from "next";
import { Eye, MousePointerClick, Percent, Timer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/cards/stat-card";
import { ChartCard } from "@/components/charts/chart-card";
import { RevenueProfitChart } from "@/components/charts/revenue-profit-chart";
import { TopProductsChart } from "@/components/charts/top-products-chart";
import { TrafficSourcesChart } from "@/components/charts/traffic-sources-chart";
import { CountryRevenueChart } from "@/components/charts/country-revenue-chart";
import { ConversionFunnelChart } from "@/components/charts/conversion-funnel-chart";
import { DeviceMixChart } from "@/components/charts/device-mix-chart";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="Deep-dive into revenue, conversion and audience performance."
        actions={
          <Button variant="outline">
            <Timer />
            Last 12 months
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sessions" value="112,480" icon={Eye} delta="+6.2%" direction="up" />
        <StatCard label="Conversion Rate" value="3.84%" icon={Percent} delta="-0.7%" direction="down" />
        <StatCard label="Add-to-Cart" value="21.9%" icon={MousePointerClick} delta="+1.1%" direction="up" />
        <StatCard label="Avg. Session" value="3m 42s" icon={Timer} delta="+4.5%" direction="up" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ChartCard
          title="Revenue vs. Profit"
          description="Monthly performance across the last 12 months"
          height={320}
          className="xl:col-span-2"
          action={<Badge variant="success">Healthy margin</Badge>}
        >
          <RevenueProfitChart />
        </ChartCard>
        <ChartCard
          title="Traffic Sources"
          description="Channel mix by visitors"
          className="xl:col-span-1"
          bodyClassName="pt-2"
        >
          <TrafficSourcesChart />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ChartCard
          title="Conversion Funnel"
          description="From first visit to purchase"
          className="xl:col-span-2"
        >
          <ConversionFunnelChart />
        </ChartCard>
        <ChartCard
          title="Device Mix"
          description="Sessions by device type"
          className="xl:col-span-1"
        >
          <DeviceMixChart />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ChartCard
          title="Top Products by Revenue"
          description="Best sellers this month"
          height={300}
          className="xl:col-span-2"
        >
          <TopProductsChart />
        </ChartCard>
        <ChartCard
          title="Revenue by Country"
          description="Top markets"
          className="xl:col-span-1"
        >
          <CountryRevenueChart />
        </ChartCard>
      </div>
    </div>
  );
}
