import Link from "next/link";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/admin/dashboard"
      className={cn("flex items-center gap-2.5 font-semibold", className)}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
        <Activity className="size-5" strokeWidth={2.5} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Commerce
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          Intelligence Lab
        </span>
      </span>
    </Link>
  );
}
