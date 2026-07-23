"use client";

import { Bell, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { notifications } from "@/lib/data";
import { cn } from "@/lib/utils";

const toneIcon = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
};

const toneColor = {
  success: "text-success",
  info: "text-primary",
  warning: "text-warning",
};

export function NotificationsMenu() {
  const unread = notifications.filter((n) => n.unread).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications (${unread} unread)`}
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute right-2 top-2 flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary ring-2 ring-card" />
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <span className="text-xs text-muted-foreground">{unread} unread</span>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {notifications.map((n) => {
            const Icon = toneIcon[n.tone];
            return (
              <div
                key={n.id}
                className="flex gap-3 px-4 py-3 transition-colors hover:bg-accent"
              >
                <span className={cn("mt-0.5 shrink-0", toneColor[n.tone])}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {n.title}
                    {n.unread && (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {n.detail}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    {n.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-border p-1.5">
          <Button variant="ghost" size="sm" className="w-full text-primary">
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
