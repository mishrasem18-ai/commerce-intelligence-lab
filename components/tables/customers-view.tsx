"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { CustomersTable } from "@/components/tables/customers-table";
import { useCustomers } from "@/lib/store/customers-store";
import { type Customer } from "@/lib/data";
import { cn } from "@/lib/utils";

const filters: Array<{ label: string; value: Customer["status"] | "All" }> = [
  { label: "All", value: "All" },
  { label: "VIP", value: "VIP" },
  { label: "Active", value: "Active" },
  { label: "New", value: "New" },
  { label: "At Risk", value: "At Risk" },
];

export function CustomersView() {
  const { customers } = useCustomers();
  const [active, setActive] = React.useState<Customer["status"] | "All">("All");
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesStatus = active === "All" || customer.status === active;
      const matchesQuery =
        !q ||
        customer.name.toLowerCase().includes(q) ||
        customer.email.toLowerCase().includes(q) ||
        customer.country.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [customers, active, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((filter) => {
            const isActive = active === filter.value;
            const count =
              filter.value === "All"
                ? customers.length
                : customers.filter((c) => c.status === filter.value).length;
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
                    isActive ? "bg-white/20" : "bg-muted text-muted-foreground",
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
            placeholder="Search customers…"
            aria-label="Search customers"
            className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <CustomersTable customers={filtered} />
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No customers found</p>
          <p className="text-sm text-muted-foreground">
            Try a different status or search term.
          </p>
        </div>
      )}
    </div>
  );
}
