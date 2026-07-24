"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/tables/order-status-badge";
import { BuyerOrderBody } from "@/components/store/buyer-order-body";
import { useBuyerOrder } from "@/lib/hooks/use-buyer-order";

export function BuyerOrderDetailView({ slug }: { slug: string }) {
  const result = useBuyerOrder(slug);

  if (result.status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (result.status !== "ok") {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <h2 className="text-lg font-semibold text-foreground">Order not found</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          We couldn&apos;t find this order for your account.
        </p>
        <Link href="/account/orders" className={buttonVariants({ variant: "outline" })}>
          Back to my orders
        </Link>
      </div>
    );
  }

  const { order } = result;

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/account/orders" className="hover:text-foreground">
          My Orders
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{order.orderNumber}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {order.orderNumber}
          </h2>
          <p className="text-sm text-muted-foreground">Placed on {order.date}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <BuyerOrderBody order={order} />
    </div>
  );
}
