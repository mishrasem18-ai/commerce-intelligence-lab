"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthlySeries } from "@/lib/data";
import { formatCompact, formatCurrency } from "@/lib/utils";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

const axisStyle = { fill: "var(--muted-foreground)", fontSize: 12 };

export function RevenueTrendChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={monthlySeries}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <XAxis
          dataKey="month"
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          dy={8}
        />
        <YAxis
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => `$${formatCompact(v)}`}
        />
        <Tooltip
          cursor={{ stroke: "var(--chart-1)", strokeWidth: 1, strokeDasharray: "4 4" }}
          content={
            <ChartTooltip
              formatter={(value) => formatCurrency(value)}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#revFill)"
          activeDot={{
            r: 4,
            strokeWidth: 2,
            stroke: "var(--card)",
            fill: "var(--chart-1)",
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
