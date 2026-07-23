"use client";

import { conversionFunnel } from "@/lib/data";
import { formatNumber, formatPercent } from "@/lib/utils";

// Ordinal single-hue ramp (darkest = top of funnel), validated ≥ 2:1 on surface.
const steps = [
  "var(--chart-1)",
  "color-mix(in srgb, var(--chart-1) 84%, var(--card))",
  "color-mix(in srgb, var(--chart-1) 68%, var(--card))",
  "color-mix(in srgb, var(--chart-1) 54%, var(--card))",
  "color-mix(in srgb, var(--chart-1) 42%, var(--card))",
];

export function ConversionFunnelChart() {
  const top = conversionFunnel[0].value;

  return (
    <div className="flex flex-col gap-3">
      {conversionFunnel.map((stage, index) => {
        const share = stage.value / top;
        const prev = index === 0 ? stage.value : conversionFunnel[index - 1].value;
        const stepRate = stage.value / prev;
        return (
          <div key={stage.stage} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{stage.stage}</span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="text-foreground">{formatNumber(stage.value)}</span>
                {index > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {formatPercent(stepRate)}
                  </span>
                )}
              </span>
            </div>
            <div className="h-8 w-full overflow-hidden rounded-lg bg-muted">
              <div
                className="flex h-full items-center rounded-lg px-3 text-xs font-medium text-white transition-all"
                style={{ width: `${share * 100}%`, background: steps[index] }}
              >
                {formatPercent(share)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
