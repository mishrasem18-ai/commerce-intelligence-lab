import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/cards/sparkline";
import type { Kpi } from "@/lib/data";
import { cn, formatPercent } from "@/lib/utils";

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const positive = kpi.direction === "up";
  const TrendIcon = positive ? ArrowUpRight : ArrowDownRight;
  // Conversion & refund style KPIs: "down" is not necessarily bad, but we keep
  // a consistent green-up / red-down convention for the delta chip.
  const strokeColor = positive ? "var(--chart-1)" : "var(--chart-8)";

  return (
    <Card className="group flex flex-col gap-4 p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
            positive
              ? "bg-success/12 text-success-foreground"
              : "bg-danger/12 text-danger-foreground",
          )}
        >
          <TrendIcon className="size-3" />
          {formatPercent(Math.abs(kpi.delta), 1)}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          {kpi.value}
        </p>
        <div className="w-24 shrink-0">
          <Sparkline data={kpi.spark} stroke={strokeColor} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{kpi.hint}</p>
    </Card>
  );
}
