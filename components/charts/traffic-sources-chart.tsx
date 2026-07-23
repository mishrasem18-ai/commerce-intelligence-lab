"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { trafficSources } from "@/lib/data";
import { formatNumber, formatPercent } from "@/lib/utils";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function TrafficSourcesChart() {
  const total = trafficSources.reduce((sum, s) => sum + s.visitors, 0);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={trafficSources}
              dataKey="visitors"
              nameKey="channel"
              innerRadius={54}
              outerRadius={80}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {trafficSources.map((entry, index) => (
                <Cell key={entry.channel} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  hideLabel
                  formatter={(value) => formatNumber(value)}
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums text-foreground">
            {formatNumber(Math.round(total / 1000))}K
          </span>
          <span className="text-[11px] text-muted-foreground">visitors</span>
        </div>
      </div>

      {/* Legend doubles as a data table so identity is never color-alone */}
      <ul className="flex w-full flex-1 flex-col gap-2.5">
        {trafficSources.map((source, index) => (
          <li
            key={source.channel}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: COLORS[index % COLORS.length] }}
              />
              {source.channel}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {formatPercent(source.share)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
