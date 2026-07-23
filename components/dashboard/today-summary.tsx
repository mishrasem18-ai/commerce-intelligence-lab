import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { todaySummary } from "@/lib/data";
import { cn } from "@/lib/utils";

export function TodaySummary() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {todaySummary.map((stat) => {
        const up = stat.direction === "up";
        const Icon = up ? ArrowUpRight : ArrowDownRight;
        return (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-muted/40 p-3"
          >
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {stat.value}
            </p>
            <p
              className={cn(
                "mt-0.5 flex items-center gap-0.5 text-xs font-medium tabular-nums",
                up ? "text-success-foreground" : "text-danger-foreground",
              )}
            >
              <Icon className="size-3" />
              {stat.delta}
            </p>
          </div>
        );
      })}
    </div>
  );
}
