import * as React from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: string;
  direction?: "up" | "down";
  hint?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  direction = "up",
  hint,
}: StatCardProps) {
  const up = direction === "up";
  const TrendIcon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-[18px]" />
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
              up
                ? "bg-success/12 text-success-foreground"
                : "bg-danger/12 text-danger-foreground",
            )}
          >
            <TrendIcon className="size-3" />
            {delta}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}
    </Card>
  );
}
