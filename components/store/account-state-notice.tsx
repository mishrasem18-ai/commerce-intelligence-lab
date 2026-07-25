"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import type { AccountState } from "@/lib/auth/buyer-state";

/**
 * Terminal (non-"ready") states of an account screen. Every account screen
 * routes through this, so a failed or missing session shows an actionable
 * message instead of an endless "Loading…".
 */
export function AccountStateNotice({
  state,
  onRetry,
}: {
  state: Exclude<AccountState, "ready">;
  onRetry: () => void;
}) {
  if (state === "loading") {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (state === "unauthenticated") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          Your session has ended. Sign in again to view your account.
        </p>
        <Link
          href="/login?redirect=/account"
          className={buttonVariants({ size: "sm" })}
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t load your account details. Please check your connection and
        try again.
      </p>
      <Button size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
