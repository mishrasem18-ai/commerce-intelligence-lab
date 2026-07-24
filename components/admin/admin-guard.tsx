"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/store/auth-store";

/**
 * Client-side backstop for the admin area. Middleware is the primary gate;
 * this handles the edge case where the cookie exists but the client session
 * was cleared, and prevents any admin UI flashing during redirect.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { admin, hydrated } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (hydrated && !admin) router.replace("/admin/login");
  }, [hydrated, admin, router]);

  if (hydrated && !admin) return null;
  return <>{children}</>;
}
