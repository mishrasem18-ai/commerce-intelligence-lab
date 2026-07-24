"use client";

import Link from "next/link";
import { ChevronRight, CreditCard, Mail, MapPin, Package, User, Wallet } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Select, type SelectOption } from "@/components/ui/select";
import { OrderStatusBadge } from "@/components/tables/order-status-badge";
import { useToast } from "@/components/ui/toast";
import { useOrders } from "@/lib/store/orders-store";
import { useCustomers } from "@/lib/store/customers-store";
import { type Order, type OrderStatus, type PaymentStatus } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

const STATUS_OPTIONS: SelectOption[] = (
  ["Processing", "Paid", "Pending", "Shipped", "Refunded", "Cancelled"] as OrderStatus[]
).map((status) => ({ value: status, label: status }));

const paymentVariant: Record<PaymentStatus, BadgeProps["variant"]> = {
  Paid: "success",
  Pending: "warning",
  Refunded: "neutral",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Derive line items for seed orders that predate the buyer checkout flow. */
function derivedLineItems(order: Order) {
  const count = Math.max(1, order.items);
  const unit = Math.round((order.amount / count) * 100) / 100;
  return Array.from({ length: count }, (_, i) => {
    const isLast = i === count - 1;
    const amount = isLast
      ? Math.round((order.amount - unit * (count - 1)) * 100) / 100
      : unit;
    return { name: `Line item ${i + 1}`, quantity: 1, price: amount };
  });
}

export function OrderDetailView({
  slug,
  initialOrder,
}: {
  slug: string;
  initialOrder: Order | null;
}) {
  const { orders, updateStatus, hydrated } = useOrders();
  const { getCustomer, customers } = useCustomers();
  const { toast } = useToast();

  const order =
    orders.find((o) => o.id.replace(/^#/, "") === slug) ?? initialOrder ?? null;

  if (!order) {
    if (!hydrated) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading order…
        </div>
      );
    }
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <h1 className="text-xl font-semibold text-foreground">Order not found</h1>
        <Link href="/admin/orders" className="text-sm text-primary hover:underline">
          Back to orders
        </Link>
      </div>
    );
  }

  const customer = order.customerId
    ? getCustomer(order.customerId)
    : customers.find((c) => c.name === order.customer);
  const items =
    order.lineItems && order.lineItems.length > 0
      ? order.lineItems.map((li) => ({
          name: li.name,
          quantity: li.quantity,
          price: li.price,
        }))
      : derivedLineItems(order);
  const address = order.shippingAddress;

  const handleStatusChange = (value: string) => {
    updateStatus(order.id, value as OrderStatus);
    toast({
      variant: "success",
      title: "Order updated",
      description: `${order.orderNumber ?? order.id} is now ${value}.`,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/admin/orders" className="transition-colors hover:text-foreground">
          Orders
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{order.orderNumber ?? order.id}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {order.orderNumber ?? order.id}
            </h1>
            <OrderStatusBadge status={order.status} />
            {order.paymentStatus && (
              <Badge variant={paymentVariant[order.paymentStatus]}>
                {order.paymentStatus}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Placed on {formatDate(order.date)} · {order.items}{" "}
            {order.items === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">Status</span>
          <Select
            label="Update order status"
            value={order.status}
            onValueChange={handleStatusChange}
            options={STATUS_OPTIONS}
            align="end"
            className="w-40"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={`${item.name}-${index}`}>
                      <TableCell>
                        <span className="flex items-center gap-2.5">
                          <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Package className="size-4" />
                          </span>
                          <span className="text-sm font-medium text-foreground">
                            {item.name}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-foreground">
                        {formatCurrency(item.price * item.quantity, {
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <dl className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm">
                {order.subtotal !== undefined && (
                  <>
                    <SummaryRow label="Subtotal" value={order.subtotal} />
                    <SummaryRow label="Tax" value={order.tax ?? 0} />
                    <SummaryRow
                      label="Shipping"
                      value={order.shipping ?? 0}
                      free={order.shipping === 0}
                    />
                  </>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-base font-semibold text-foreground">Total</span>
                  <span className="text-base font-semibold tabular-nums text-foreground">
                    {formatCurrency(order.amount, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </dl>
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
                  {address.city}, {address.state} {address.postalCode}, {address.country}
                </p>
                <p className="mt-1">{address.mobile}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={order.customer} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{order.customer}</p>
                  <p className="truncate text-sm text-muted-foreground">{order.email}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4" />
                  {order.country}
                </span>
                <a
                  href={`mailto:${order.email}`}
                  className="flex items-center gap-2 text-primary transition-colors hover:underline"
                >
                  <Mail className="size-4" />
                  Email customer
                </a>
                {customer && (
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="flex items-center gap-2 text-primary transition-colors hover:underline"
                  >
                    <User className="size-4" />
                    View customer profile
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {order.paymentMethod && (
            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
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
                    <p className="text-muted-foreground">
                      {order.paymentStatus ?? "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  free,
}: {
  label: string;
  value: number;
  free?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">
        {free ? "Free" : formatCurrency(value, { maximumFractionDigits: 2 })}
      </dd>
    </div>
  );
}
