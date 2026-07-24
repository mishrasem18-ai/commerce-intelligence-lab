"use client";

import Link from "next/link";
import { ChevronRight, Mail, MapPin, Package, ShoppingCart } from "lucide-react";
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
import { Select, type SelectOption } from "@/components/ui/select";
import { OrderStatusBadge } from "@/components/tables/order-status-badge";
import { useToast } from "@/components/ui/toast";
import { useOrders } from "@/lib/store/orders-store";
import { customers, type Order, type OrderStatus } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

const STATUS_OPTIONS: SelectOption[] = (
  ["Paid", "Pending", "Shipped", "Refunded", "Cancelled"] as OrderStatus[]
).map((status) => ({ value: status, label: status }));

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Deterministic line-item breakdown from the order's item count + total. */
function lineItems(order: Order) {
  const count = Math.max(1, order.items);
  const unit = Math.round((order.amount / count) * 100) / 100;
  return Array.from({ length: count }, (_, i) => {
    const isLast = i === count - 1;
    const amount = isLast
      ? Math.round((order.amount - unit * (count - 1)) * 100) / 100
      : unit;
    return { name: `Line item ${i + 1}`, qty: 1, amount };
  });
}

export function OrderDetailView({ initialOrder }: { initialOrder: Order }) {
  const { orders, updateStatus } = useOrders();
  const { toast } = useToast();

  const order = orders.find((o) => o.id === initialOrder.id) ?? initialOrder;
  const customer = customers.find((c) => c.name === order.customer);
  const items = lineItems(order);

  const handleStatusChange = (value: string) => {
    updateStatus(order.id, value as OrderStatus);
    toast({
      variant: "success",
      title: "Order updated",
      description: `${order.id} is now ${value}.`,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/orders" className="transition-colors hover:text-foreground">
          Orders
        </Link>
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{order.id}</span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {order.id}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Placed on {formatDate(order.date)} · {order.items}{" "}
            {order.items === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            Status
          </span>
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
                  {items.map((item) => (
                    <TableRow key={item.name}>
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
                        {item.qty}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-foreground">
                        {formatCurrency(item.amount, { maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm font-medium text-foreground">Total</span>
                <span className="text-lg font-semibold tabular-nums text-foreground">
                  {formatCurrency(order.amount, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
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
                  <p className="truncate font-medium text-foreground">
                    {order.customer}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {order.email}
                  </p>
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
                    href={`/customers/${customer.id}`}
                    className="flex items-center gap-2 text-primary transition-colors hover:underline"
                  >
                    <ShoppingCart className="size-4" />
                    View customer profile
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border/70 text-sm">
                <Row label="Order total">
                  {formatCurrency(order.amount, { maximumFractionDigits: 2 })}
                </Row>
                <Row label="Items">{order.items}</Row>
                <Row label="Date">{formatDate(order.date)}</Row>
                <Row label="Status">
                  <OrderStatusBadge status={order.status} />
                </Row>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{children}</dd>
    </div>
  );
}
