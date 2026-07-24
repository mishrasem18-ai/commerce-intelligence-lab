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
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { Customer } from "@/lib/data";
import { formatCurrency, formatNumber } from "@/lib/utils";

const statusVariant: Record<Customer["status"], BadgeProps["variant"]> = {
  VIP: "default",
  Active: "success",
  New: "neutral",
  "At Risk": "warning",
};

export function CustomersTable({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const open = (id: string) => router.push(`/customers/${id}`);

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Customer</TableHead>
          <TableHead className="hidden md:table-cell">Country</TableHead>
          <TableHead className="text-right">Orders</TableHead>
          <TableHead className="text-right">Total Spent</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden sm:table-cell">Last Seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow
            key={customer.id}
            role="link"
            tabIndex={0}
            onClick={() => open(customer.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open(customer.id);
              }
            }}
            className="cursor-pointer focus:bg-muted focus:outline-none"
          >
            <TableCell>
              <div className="flex items-center gap-2.5">
                <Avatar name={customer.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {customer.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {customer.email}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              <span className="flex items-center gap-2">
                <span className="inline-flex h-5 min-w-8 items-center justify-center rounded border border-border bg-muted px-1 text-[10px] font-semibold">
                  {customer.countryCode}
                </span>
                {customer.country}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {formatNumber(customer.orders)}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums text-foreground">
              {formatCurrency(customer.spent)}
            </TableCell>
            <TableCell>
              <Badge variant={statusVariant[customer.status]}>
                {customer.status}
              </Badge>
            </TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">
              {customer.lastSeen}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
