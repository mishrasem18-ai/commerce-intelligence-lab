"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/store/cart-store";

export function CartButton() {
  const { count } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={`Cart (${count} ${count === 1 ? "item" : "items"})`}
      className="relative flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent"
    >
      <ShoppingCart className="size-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold tabular-nums text-primary-foreground ring-2 ring-background">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
