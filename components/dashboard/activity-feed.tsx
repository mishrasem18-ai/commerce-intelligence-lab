import {
  ShoppingCart,
  UserPlus,
  PackageX,
  Star,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { activityFeed, type ActivityKind } from "@/lib/data";
import { cn } from "@/lib/utils";

const kindConfig: Record<
  ActivityKind,
  { icon: LucideIcon; className: string }
> = {
  order: { icon: ShoppingCart, className: "bg-primary/10 text-primary" },
  customer: { icon: UserPlus, className: "bg-chart-3/12 text-[color:var(--chart-3)]" },
  product: { icon: PackageX, className: "bg-warning/15 text-warning-foreground" },
  review: { icon: Star, className: "bg-chart-4/15 text-[color:var(--chart-4)]" },
  refund: { icon: RotateCcw, className: "bg-danger/12 text-danger-foreground" },
};

export function ActivityFeed() {
  return (
    <ol className="relative flex flex-col">
      {activityFeed.map((item, index) => {
        const config = kindConfig[item.kind];
        const Icon = config.icon;
        const last = index === activityFeed.length - 1;
        return (
          <li key={item.id} className="flex gap-3.5 pb-5 last:pb-0">
            <div className="relative flex flex-col items-center">
              <span
                className={cn(
                  "z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                  config.className,
                )}
              >
                <Icon className="size-4" />
              </span>
              {!last && (
                <span className="absolute top-8 h-full w-px bg-border" />
              )}
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.detail}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                {item.time}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
