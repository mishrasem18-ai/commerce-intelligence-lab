"use client";

import Link from "next/link";
import { ChevronRight, MapPin, Package } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/tables/order-status-badge";
import { useBuyerCustomer } from "@/lib/hooks/use-buyer-customer";
import { useOrders } from "@/lib/store/orders-store";
import { cn, formatCurrency } from "@/lib/utils";

export function AccountDashboard() {
  const { customer, hydrated } = useBuyerCustomer();
  const { orders } = useOrders();

  if (!hydrated || !customer) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const myOrders = orders
    .filter((o) => o.customerId === customer.id)
    .sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date));
  const defaultAddress =
    customer.addresses?.find((a) => a.isDefault) ?? customer.addresses?.[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium text-foreground">{customer.name}</p>
            <p className="text-muted-foreground">{customer.email}</p>
            {customer.mobile && (
              <p className="text-muted-foreground">{customer.mobile}</p>
            )}
            <Link
              href="/account/profile"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Edit profile <ChevronRight className="size-4" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              Default Address
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {defaultAddress ? (
              <>
                <p className="font-medium text-foreground">{defaultAddress.fullName}</p>
                <p>
                  {defaultAddress.line1}, {defaultAddress.city}, {defaultAddress.state}{" "}
                  {defaultAddress.postalCode}
                </p>
                <p>{defaultAddress.country}</p>
              </>
            ) : (
              <p>
                No address saved yet.{" "}
                <Link href="/account/addresses" className="text-primary hover:underline">
                  Add one
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent Orders</CardTitle>
          <Link
            href="/account/orders"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {myOrders.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Package className="size-6" />
              </span>
              <p className="text-sm text-muted-foreground">
                You haven&apos;t placed any orders yet.
              </p>
              <Link href="/shop" className={cn(buttonVariants({ size: "sm" }))}>
                Start shopping
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border/70">
              {myOrders.slice(0, 5).map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/account/orders/${order.orderNumber}`}
                    className="flex items-center justify-between gap-3 py-3 transition-colors first:pt-0 last:pb-0 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {order.orderNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.date} · {order.items} item{order.items === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={order.status} />
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(order.amount, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
