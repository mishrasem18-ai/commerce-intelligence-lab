"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { monthlySeries } from "@/lib/data";
import { formatCompact, formatNumber } from "@/lib/utils";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

const axisStyle = { fill: "var(--muted-foreground)", fontSize: 12 };

export function OrdersByMonthChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={monthlySeries}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        barCategoryGap="28%"
      >
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
          width={44}
          tickFormatter={(v: number) => formatCompact(v)}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5, radius: 6 }}
          content={
            <ChartTooltip formatter={(value) => formatNumber(value)} />
          }
        />
        <Bar
          dataKey="orders"
          name="Orders"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
