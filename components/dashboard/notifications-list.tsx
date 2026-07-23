import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { notifications, type Notification } from "@/lib/data";
import { cn } from "@/lib/utils";

const toneConfig: Record<
  Notification["tone"],
  { icon: LucideIcon; className: string }
> = {
  success: { icon: CheckCircle2, className: "text-success" },
  info: { icon: Info, className: "text-primary" },
  warning: { icon: AlertTriangle, className: "text-warning" },
};

export function NotificationsList() {
  return (
    <ul className="flex flex-col gap-1">
      {notifications.map((n) => {
        const config = toneConfig[n.tone];
        const Icon = config.icon;
        return (
          <li
            key={n.id}
            className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60"
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", config.className)} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                {n.title}
                {n.unread && (
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                )}
              </p>
              <p className="text-xs text-muted-foreground">{n.detail}</p>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground/70">
              {n.time}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
