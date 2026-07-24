import { CreditCard, MapPin, Wallet } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { OrderStatusBadge } from "@/components/tables/order-status-badge";
import { OrderSummary } from "@/components/store/order-summary";
import type { Order, PaymentStatus } from "@/lib/data";
import { computeOrderTotals } from "@/lib/commerce";
import { formatCurrency } from "@/lib/utils";

const paymentStatusVariant: Record<PaymentStatus, BadgeProps["variant"]> = {
  Paid: "success",
  Pending: "warning",
  Refunded: "neutral",
};

export function BuyerOrderBody({ order }: { order: Order }) {
  const totals =
    order.subtotal !== undefined
      ? {
          subtotal: order.subtotal,
          tax: order.tax ?? 0,
          shipping: order.shipping ?? 0,
          total: order.total ?? order.amount,
        }
      : computeOrderTotals(order.amount);
  const items = order.lineItems ?? [];
  const address = order.shippingAddress;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border/70">
            {items.length > 0 ? (
              items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} ×{" "}
                      {formatCurrency(item.price, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(item.price * item.quantity, {
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-2 text-sm text-muted-foreground">
                {order.items} item{order.items === 1 ? "" : "s"} · total{" "}
                {formatCurrency(order.amount, { maximumFractionDigits: 2 })}
              </p>
            )}
          </CardContent>
        </Card>

        {address && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                Shipping Address
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{address.fullName}</p>
              <p>
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
              </p>
              <p>
                {address.city}, {address.state} {address.postalCode}
              </p>
              <p>{address.country}</p>
              <p className="mt-1">{address.mobile}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <OrderSummary totals={totals} />
            <div className="flex flex-col gap-2 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Order status</span>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Payment</span>
                {order.paymentStatus ? (
                  <Badge variant={paymentStatusVariant[order.paymentStatus]}>
                    {order.paymentStatus}
                  </Badge>
                ) : (
                  <span className="text-foreground">—</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {order.paymentMethod && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {order.paymentMethod === "Card" ? (
                    <CreditCard className="size-4" />
                  ) : (
                    <Wallet className="size-4" />
                  )}
                </span>
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    {order.paymentMethod === "Card"
                      ? "Credit / Debit Card"
                      : "Cash on Delivery"}
                  </p>
                  <p className="text-muted-foreground">Demo payment</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
