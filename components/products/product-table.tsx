"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/products/status-badge";
import { InventoryBadge } from "@/components/products/inventory-badge";
import { ProductImage } from "@/components/products/product-image";
import {
  ProductActionsMenu,
  type ProductAction,
} from "@/components/products/product-actions-menu";
import { CATEGORY_ICON } from "@/components/products/category-visuals";
import type { Product, ProductSortKey } from "@/lib/data/products";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

export interface SortState {
  key: ProductSortKey;
  dir: SortDirection;
}

interface ProductTableProps {
  products: Product[];
  sort: SortState;
  onSortChange: (key: ProductSortKey) => void;
  onAction: (action: ProductAction, product: Product) => void;
}

function SortableHead({
  label,
  sortKey,
  sort,
  onSortChange,
  align = "right",
  className,
}: {
  label: string;
  sortKey: ProductSortKey;
  sort: SortState;
  onSortChange: (key: ProductSortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <TableHead className={cn(align === "right" && "text-right", className)}>
      <button
        type="button"
        onClick={() => onSortChange(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon
          className={cn(
            "size-3.5",
            active ? "text-primary" : "text-muted-foreground/60",
          )}
        />
      </button>
    </TableHead>
  );
}

export function ProductTable({
  products,
  sort,
  onSortChange,
  onAction,
}: ProductTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-14">Image</TableHead>
          <TableHead>Product</TableHead>
          <TableHead className="hidden lg:table-cell">Brand</TableHead>
          <TableHead className="hidden md:table-cell">Category</TableHead>
          <SortableHead label="Price" sortKey="price" sort={sort} onSortChange={onSortChange} />
          <SortableHead
            label="Inventory"
            sortKey="inventory"
            sort={sort}
            onSortChange={onSortChange}
          />
          <SortableHead
            label="Revenue"
            sortKey="revenue"
            sort={sort}
            onSortChange={onSortChange}
            className="hidden sm:table-cell"
          />
          <SortableHead
            label="Units"
            sortKey="unitsSold"
            sort={sort}
            onSortChange={onSortChange}
            className="hidden xl:table-cell"
          />
          <TableHead>Status</TableHead>
          <TableHead className="w-12 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => {
          const CategoryIcon = CATEGORY_ICON[product.category];
          return (
            <TableRow key={product.id}>
              <TableCell>
                <Link href={`/products/${product.id}`} aria-label={`View ${product.name}`}>
                  <ProductImage
                    src={product.image}
                    alt={product.name}
                    category={product.category}
                    className="size-10 rounded-lg"
                    iconSize={18}
                  />
                </Link>
              </TableCell>
              <TableCell>
                <div className="min-w-0 max-w-[15rem]">
                  <Link
                    href={`/products/${product.id}`}
                    className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                  >
                    {product.name}
                  </Link>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {product.sku}
                  </p>
                </div>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                {product.brand}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CategoryIcon className="size-3.5" />
                  {product.category}
                </span>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums text-foreground">
                {formatCurrency(product.price, { maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell className="text-right">
                <InventoryBadge inventory={product.inventory} />
              </TableCell>
              <TableCell className="hidden text-right font-medium tabular-nums text-foreground sm:table-cell">
                {formatCurrency(product.revenue)}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums text-muted-foreground xl:table-cell">
                {formatNumber(product.unitsSold)}
              </TableCell>
              <TableCell>
                <StatusBadge status={product.status} />
              </TableCell>
              <TableCell className="text-right">
                <ProductActionsMenu product={product} onAction={onAction} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
