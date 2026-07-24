"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { RecentOrdersTable } from "@/components/tables/recent-orders-table";
import { useOrders } from "@/lib/store/orders-store";
import { type OrderStatus } from "@/lib/data";
import { cn } from "@/lib/utils";

const filters: Array<{ label: string; value: OrderStatus | "All" }> = [
  { label: "All", value: "All" },
  { label: "Processing", value: "Processing" },
  { label: "Paid", value: "Paid" },
  { label: "Pending", value: "Pending" },
  { label: "Shipped", value: "Shipped" },
  { label: "Refunded", value: "Refunded" },
  { label: "Cancelled", value: "Cancelled" },
];

export function OrdersView() {
  const { orders } = useOrders();
  const [active, setActive] = React.useState<OrderStatus | "All">("All");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = active === "All" || order.status === active;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        order.customer.toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q) ||
        order.email.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [orders, active, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((filter) => {
            const isActive = active === filter.value;
            const count =
              filter.value === "All"
                ? orders.length
                : orders.filter((o) => o.status === filter.value).length;
            return (
              <button
                key={filter.value}
                onClick={() => setActive(filter.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {filter.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] tabular-nums",
                    isActive
                      ? "bg-white/20"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search orders…"
            aria-label="Search orders"
            className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <RecentOrdersTable orders={filtered} />
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No orders found</p>
          <p className="text-sm text-muted-foreground">
            Try a different status or search term.
          </p>
        </div>
      )}
    </div>
  );
}
