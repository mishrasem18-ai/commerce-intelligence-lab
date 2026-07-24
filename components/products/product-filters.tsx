"use client";

import { LayoutGrid, ListFilter, Search, Table2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  PRICE_BUCKETS,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  SORT_OPTIONS,
  type ProductSortKey,
} from "@/lib/data/products";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "table";

export interface ProductFilterState {
  query: string;
  category: string;
  status: string;
  price: string;
  sort: ProductSortKey;
}

interface ProductFiltersProps {
  filters: ProductFilterState;
  view: ViewMode;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onSortChange: (value: ProductSortKey) => void;
  onViewChange: (value: ViewMode) => void;
}

const categoryOptions: SelectOption[] = [
  { value: "all", label: "All categories" },
  ...PRODUCT_CATEGORIES.map((category) => ({ value: category, label: category })),
];

const statusOptions: SelectOption[] = [
  { value: "all", label: "All statuses" },
  ...PRODUCT_STATUSES.map((status) => ({ value: status, label: status })),
];

const priceOptions: SelectOption[] = [
  { value: "all", label: "Any price" },
  ...PRICE_BUCKETS.map((bucket) => ({ value: bucket.id, label: bucket.label })),
];

const sortOptions: SelectOption[] = SORT_OPTIONS.map((option) => ({
  value: option.id,
  label: option.label,
}));

export function ProductFilters({
  filters,
  view,
  onQueryChange,
  onCategoryChange,
  onStatusChange,
  onPriceChange,
  onSortChange,
  onViewChange,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by name, SKU or brand…"
            aria-label="Search products"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            Sort by
          </span>
          <Select
            label="Sort products"
            value={filters.sort}
            onValueChange={(value) => onSortChange(value as ProductSortKey)}
            options={sortOptions}
            align="end"
            className="w-40"
          />
          <div className="flex items-center rounded-lg border border-input bg-card p-0.5 shadow-sm">
            <ViewButton
              active={view === "grid"}
              label="Grid view"
              icon={<LayoutGrid className="size-4" />}
              onClick={() => onViewChange("grid")}
            />
            <ViewButton
              active={view === "table"}
              label="Table view"
              icon={<Table2 className="size-4" />}
              onClick={() => onViewChange("table")}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <ListFilter className="size-4" />
          Filters
        </span>
        <Select
          label="Filter by category"
          value={filters.category}
          onValueChange={onCategoryChange}
          options={categoryOptions}
          className="w-[10.5rem]"
        />
        <Select
          label="Filter by status"
          value={filters.status}
          onValueChange={onStatusChange}
          options={statusOptions}
          className="w-40"
        />
        <Select
          label="Filter by price"
          value={filters.price}
          onValueChange={onPriceChange}
          options={priceOptions}
          className="w-40"
        />
      </div>
    </div>
  );
}

function ViewButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}
