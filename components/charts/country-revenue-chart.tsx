"use client";

import { countryRevenue } from "@/lib/data";
import { formatCurrency, formatPercent } from "@/lib/utils";

/**
 * Ranked country revenue as a labelled bar list — clearer than a map for
 * six markets, and single-hue so it needs no CVD-sensitive palette.
 */
export function CountryRevenueChart() {
  const max = Math.max(...countryRevenue.map((c) => c.revenue));
  const total = countryRevenue.reduce((sum, c) => sum + c.revenue, 0);

  return (
    <ul className="flex flex-col gap-4">
      {countryRevenue.map((c) => {
        const pct = c.revenue / total;
        return (
          <li key={c.code} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <span className="inline-flex h-5 min-w-8 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                  {c.code}
                </span>
                {c.country}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatCurrency(c.revenue)}
                <span className="ml-2 text-xs text-muted-foreground/70">
                  {formatPercent(pct)}
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(c.revenue / max) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
