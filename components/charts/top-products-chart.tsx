"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { products } from "@/lib/data";
import { formatCompact, formatCurrency } from "@/lib/utils";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

const data = [...products]
  .sort((a, b) => b.revenue - a.revenue)
  .slice(0, 6)
  .map((p) => ({ name: p.name, short: p.name.split(" ")[0], revenue: p.revenue }));

// Single-hue sequential emphasis: the leader is darkest, tail steps lighter.
const shades = [
  "var(--chart-1)",
  "color-mix(in srgb, var(--chart-1) 88%, var(--card))",
  "color-mix(in srgb, var(--chart-1) 76%, var(--card))",
  "color-mix(in srgb, var(--chart-1) 64%, var(--card))",
  "color-mix(in srgb, var(--chart-1) 52%, var(--card))",
  "color-mix(in srgb, var(--chart-1) 42%, var(--card))",
];

export function TopProductsChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 56, left: 4, bottom: 0 }}
        barCategoryGap="26%"
      >
        <CartesianGrid
          horizontal={false}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="short"
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5, radius: 6 }}
          content={
            <ChartTooltip
              formatter={(value) => formatCurrency(value)}
              labelFormatter={(label) => {
                const match = data.find((d) => d.short === label);
                return match?.name ?? label;
              }}
            />
          }
        />
        <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]} maxBarSize={26}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={shades[index] ?? shades[shades.length - 1]} />
          ))}
          <LabelList
            dataKey="revenue"
            position="right"
            offset={10}
            formatter={(value: ReactNode) =>
              typeof value === "number" ? `$${formatCompact(value)}` : ""
            }
            className="fill-muted-foreground text-[11px] font-medium"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
