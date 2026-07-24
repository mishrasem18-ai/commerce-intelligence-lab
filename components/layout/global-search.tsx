"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Package, Search, ShoppingCart, Users, type LucideIcon } from "lucide-react";
import { useProducts } from "@/lib/store/products-store";
import { useOrders } from "@/lib/store/orders-store";
import { customers } from "@/lib/data";
import { cn, formatCurrency } from "@/lib/utils";

type EntityType = "product" | "order" | "customer";

interface SearchItem {
  id: string;
  type: EntityType;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
}

const GROUP_LABEL: Record<EntityType, string> = {
  product: "Products",
  order: "Orders",
  customer: "Customers",
};

const PER_GROUP = 5;

export function GlobalSearch({
  autoFocus = false,
  onNavigate,
  className,
}: {
  autoFocus?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const { products } = useProducts();
  const { orders } = useOrders();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K focuses the field.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  const items = React.useMemo<SearchItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const productItems: SearchItem[] = products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q),
      )
      .slice(0, PER_GROUP)
      .map((p) => ({
        id: p.id,
        type: "product",
        title: p.name,
        subtitle: `${p.sku} · ${p.category}`,
        href: `/products/${p.id}`,
        icon: Package,
      }));

    const orderItems: SearchItem[] = orders
      .filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q),
      )
      .slice(0, PER_GROUP)
      .map((o) => ({
        id: o.id,
        type: "order",
        title: o.id,
        subtitle: `${o.customer} · ${formatCurrency(o.amount, { maximumFractionDigits: 2 })}`,
        href: `/orders/${encodeURIComponent(o.id.replace(/^#/, ""))}`,
        icon: ShoppingCart,
      }));

    const customerItems: SearchItem[] = customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
      )
      .slice(0, PER_GROUP)
      .map((c) => ({
        id: c.id,
        type: "customer",
        title: c.name,
        subtitle: c.email,
        href: `/customers/${c.id}`,
        icon: Users,
      }));

    return [...productItems, ...orderItems, ...customerItems];
  }, [query, products, orders]);

  const select = (item: SearchItem) => {
    router.push(item.href);
    setOpen(false);
    setQuery("");
    onNavigate?.();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) select(item);
    }
  };

  const showDropdown = open && query.trim().length > 0;
  const groups: EntityType[] = ["product", "order", "customer"];

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        autoFocus={autoFocus}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search orders, products, customers…"
        aria-label="Search"
        aria-expanded={showDropdown}
        role="combobox"
        aria-controls="global-search-results"
        className="h-9 w-full rounded-lg border border-input bg-muted/50 pl-9 pr-16 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/20"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 select-none items-center gap-0.5 rounded border border-border bg-card px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
        ⌘K
      </kbd>

      {showDropdown && (
        <div
          id="global-search-results"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-lg shadow-black/10 animate-pop"
        >
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results for “{query.trim()}”
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              {groups.map((group) => {
                const groupItems = items.filter((item) => item.type === group);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group} className="mb-1 last:mb-0">
                    <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {GROUP_LABEL[group]}
                    </p>
                    {groupItems.map((item) => {
                      const flatIndex = items.indexOf(item);
                      const Icon = item.icon;
                      const active = flatIndex === activeIndex;
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          onClick={() => select(item)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                            active ? "bg-accent" : "hover:bg-accent/60",
                          )}
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {item.title}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
