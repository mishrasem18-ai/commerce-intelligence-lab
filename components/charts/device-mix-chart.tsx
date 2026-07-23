"use client";

import { Smartphone, Monitor, Tablet, type LucideIcon } from "lucide-react";
import { deviceMix } from "@/lib/data";
import { formatPercent } from "@/lib/utils";

// Three categories — within the all-pairs safe cap of the categorical palette.
const config: Record<string, { color: string; icon: LucideIcon }> = {
  Mobile: { color: "var(--chart-1)", icon: Smartphone },
  Desktop: { color: "var(--chart-2)", icon: Monitor },
  Tablet: { color: "var(--chart-3)", icon: Tablet },
};

export function DeviceMixChart() {
  return (
    <div className="flex flex-col gap-5">
      {/* Single stacked bar reads share at a glance */}
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {deviceMix.map((d) => (
          <div
            key={d.device}
            style={{
              width: `${d.share * 100}%`,
              background: config[d.device]?.color,
            }}
            className="h-full border-r-2 border-card last:border-r-0"
          />
        ))}
      </div>
      <ul className="flex flex-col gap-3">
        {deviceMix.map((d) => {
          const Icon = config[d.device]?.icon ?? Smartphone;
          return (
            <li key={d.device} className="flex items-center gap-3 text-sm">
              <span
                className="flex size-8 items-center justify-center rounded-lg"
                style={{
                  background: `color-mix(in srgb, ${config[d.device]?.color} 14%, transparent)`,
                  color: config[d.device]?.color,
                }}
              >
                <Icon className="size-4" />
              </span>
              <span className="flex-1 font-medium text-foreground">
                {d.device}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatPercent(d.share)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
