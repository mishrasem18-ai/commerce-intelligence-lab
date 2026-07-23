"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthlySeries } from "@/lib/data";
import { formatCompact, formatCurrency } from "@/lib/utils";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

const axisStyle = { fill: "var(--muted-foreground)", fontSize: 12 };

/** Revenue vs. profit — same $ unit, single axis (no dual-axis). */
export function RevenueProfitChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={monthlySeries}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="rpRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="rpProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} dy={8} />
        <YAxis
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => `$${formatCompact(v)}`}
        />
        <Tooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          content={<ChartTooltip formatter={(value) => formatCurrency(value)} />}
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={28}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#rpRevenue)"
        />
        <Area
          type="monotone"
          dataKey="profit"
          name="Profit"
          stroke="var(--chart-3)"
          strokeWidth={2}
          fill="url(#rpProfit)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
