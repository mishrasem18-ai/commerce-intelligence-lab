"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  /** Accessible label, announced to screen readers. */
  label: string;
  placeholder?: string;
  icon?: React.ReactNode;
  align?: "start" | "end";
  className?: string;
  triggerClassName?: string;
}

/**
 * Lightweight, dependency-free select — mirrors the dropdown-menu interaction
 * model (outside-click / Escape to close) but is controlled by a value.
 */
export function Select({
  value,
  onValueChange,
  options,
  label,
  placeholder = "Select…",
  icon,
  align = "start",
  className,
  triggerClassName,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((option) => option.value === value);

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm shadow-sm transition-colors",
          "hover:bg-accent/50 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
          triggerClassName,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
          )}
          <span
            className={cn(
              "truncate",
              selected ? "text-foreground" : "text-muted-foreground/70",
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute top-[calc(100%+0.4rem)] z-50 max-h-72 min-w-full overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg shadow-black/5",
            "origin-top animate-pop",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent focus:bg-accent focus:outline-none",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                <span className="truncate">{option.label}</span>
                {active && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
