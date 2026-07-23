"use client";

import type { ReactNode } from "react";

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  formatter?: (value: number, entry: TooltipEntry) => ReactNode;
  labelFormatter?: (label: string | number) => ReactNode;
  hideLabel?: boolean;
}

/**
 * Shared tooltip for all Recharts figures — themed surface, tabular figures,
 * a color swatch per series so identity is never color-alone next to text.
 */
export function ChartTooltip({
  active,
  label,
  payload,
  formatter,
  labelFormatter,
  hideLabel,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-36 rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg shadow-black/10 backdrop-blur">
      {!hideLabel && label !== undefined && (
        <p className="mb-1.5 font-medium text-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry, index) => (
          <div
            key={`${entry.dataKey}-${index}`}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2 shrink-0 rounded-[3px]"
                style={{ background: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {typeof entry.value === "number" && formatter
                ? formatter(entry.value, entry)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
