"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/store/auth-store";

/** Client backstop for buyer-only areas (middleware is the primary gate). */
export function BuyerGuard({ children }: { children: React.ReactNode }) {
  const { buyer, hydrated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (hydrated && !buyer) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, buyer, router, pathname]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!buyer) return null;
  return <>{children}</>;
}
