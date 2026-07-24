import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

export const STORE_NAME = "Aurora Market";

export function StoreBrand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
        <ShoppingBag className="size-5" strokeWidth={2.4} />
      </span>
      <span className="text-base font-semibold tracking-tight text-foreground">
        {STORE_NAME}
      </span>
    </Link>
  );
}
