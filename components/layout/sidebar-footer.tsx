import { TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function SidebarFooter() {
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="size-4" />
          </span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-sidebar-foreground">
              Growth Plan
            </p>
            <p className="text-[11px] text-sidebar-muted">72% of data limit</p>
          </div>
        </div>
        <Progress value={72} className="mt-3 h-1.5 bg-sidebar-border" />
        <p className="mt-2 text-[11px] leading-relaxed text-sidebar-muted">
          7.2M of 10M events tracked this month.
        </p>
      </div>
    </div>
  );
}
