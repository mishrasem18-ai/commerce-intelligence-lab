"use client";

import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { OrderStatusBadge } from "@/components/tables/order-status-badge";
import { useBuyerCustomer } from "@/lib/hooks/use-buyer-customer";
import { useOrders } from "@/lib/store/orders-store";
import type { PaymentStatus } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

const paymentVariant: Record<PaymentStatus, BadgeProps["variant"]> = {
  Paid: "success",
  Pending: "warning",
  Refunded: "neutral",
};

export function BuyerOrdersList() {
  const { customer, hydrated } = useBuyerCustomer();
  const { orders } = useOrders();

  if (!hydrated || !customer) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const myOrders = orders
    .filter((o) => o.customerId === customer.id)
    .sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date));

  if (myOrders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Package className="size-7" />
          </span>
          <p className="text-sm font-medium text-foreground">No orders yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            When you place an order it will appear here.
          </p>
          <Link href="/shop" className={buttonVariants({ size: "sm" })}>
            Browse products
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {myOrders.map((order) => (
        <Link key={order.id} href={`/account/orders/${order.orderNumber}`}>
          <Card className="transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {order.orderNumber}
                  </p>
                  <OrderStatusBadge status={order.status} />
                  {order.paymentStatus && (
                    <Badge variant={paymentVariant[order.paymentStatus]}>
                      {order.paymentStatus}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {order.date} · {order.items} item{order.items === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {formatCurrency(order.amount, { maximumFractionDigits: 2 })}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
