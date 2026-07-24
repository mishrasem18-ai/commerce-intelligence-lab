"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { OrderStatusBadge } from "@/components/tables/order-status-badge";
import type { Order } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Route param for an order (ids are stored like "#ORD-7841"). */
export function orderSlug(id: string): string {
  return id.replace(/^#/, "");
}

interface RecentOrdersTableProps {
  orders: Order[];
  /** Hide secondary columns for tighter dashboard placements. */
  compact?: boolean;
}

export function RecentOrdersTable({ orders, compact }: RecentOrdersTableProps) {
  const router = useRouter();

  const open = (id: string) => router.push(`/orders/${orderSlug(id)}`);

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Order</TableHead>
          <TableHead>Customer</TableHead>
          {!compact && <TableHead className="hidden md:table-cell">Country</TableHead>}
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          {!compact && <TableHead className="hidden sm:table-cell">Date</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow
            key={order.id}
            role="link"
            tabIndex={0}
            onClick={() => open(order.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open(order.id);
              }
            }}
            className="cursor-pointer focus:bg-muted focus:outline-none"
          >
            <TableCell className="font-medium tabular-nums text-primary">
              {order.id}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2.5">
                <Avatar name={order.customer} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {order.customer}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {order.email}
                  </p>
                </div>
              </div>
            </TableCell>
            {!compact && (
              <TableCell className="hidden text-muted-foreground md:table-cell">
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-5 min-w-8 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-semibold">
                    {order.countryCode}
                  </span>
                  {order.country}
                </span>
              </TableCell>
            )}
            <TableCell className="text-right font-medium tabular-nums text-foreground">
              {formatCurrency(order.amount, { maximumFractionDigits: 2 })}
            </TableCell>
            <TableCell>
              <OrderStatusBadge status={order.status} />
            </TableCell>
            {!compact && (
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {formatDate(order.date)}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
