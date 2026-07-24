"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/toast";
import {
  ProductFilters,
  type ProductFilterState,
  type ViewMode,
} from "@/components/products/product-filters";
import { ProductCard, PRODUCT_GRID_CLASS } from "@/components/products/product-card";
import { ProductTable, type SortState } from "@/components/products/product-table";
import { ProductsEmpty } from "@/components/products/products-empty";
import {
  ProductEditDialog,
  type ProductFormValues,
} from "@/components/products/product-edit-dialog";
import type { ProductAction } from "@/components/products/product-actions-menu";
import { useProducts } from "@/lib/store/products-store";
import {
  PRICE_BUCKETS,
  type Product,
  type ProductSortKey,
} from "@/lib/data/products";
import { formatNumber } from "@/lib/utils";

const PAGE_SIZE = 20;

const DEFAULT_FILTERS: ProductFilterState = {
  query: "",
  category: "all",
  status: "all",
  price: "all",
  sort: "newest",
};

const SORT_VALUE: Record<ProductSortKey, (product: Product) => number> = {
  newest: (product) => Date.parse(product.createdAt),
  price: (product) => product.price,
  revenue: (product) => product.revenue,
  inventory: (product) => product.inventory,
  unitsSold: (product) => product.unitsSold,
};

export function ProductsExplorer() {
  const router = useRouter();
  const { toast } = useToast();
  const { products, updateProduct, duplicateProduct, deleteProduct, toggleStatus } =
    useProducts();

  const [filters, setFilters] = React.useState<ProductFilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = React.useState<SortState>({ key: "newest", dir: "desc" });
  const [view, setView] = React.useState<ViewMode>("grid");
  const [page, setPage] = React.useState(1);
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Product | null>(null);

  const resetPage = () => setPage(1);

  const setFilter = <K extends keyof ProductFilterState>(
    key: K,
    value: ProductFilterState[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    resetPage();
  };

  const handleSelectSort = (key: ProductSortKey) => {
    setFilter("sort", key);
    setSort({ key, dir: "desc" });
  };

  const handleTableSort = (key: ProductSortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
    setFilters((prev) => ({ ...prev, sort: key }));
    resetPage();
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSort({ key: "newest", dir: "desc" });
    resetPage();
  };

  const filtered = React.useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const bucket = PRICE_BUCKETS.find((entry) => entry.id === filters.price);

    const result = products.filter((product) => {
      const matchesQuery =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.brand.toLowerCase().includes(query);
      const matchesCategory =
        filters.category === "all" || product.category === filters.category;
      const matchesStatus =
        filters.status === "all" || product.status === filters.status;
      const matchesPrice =
        !bucket || (product.price >= bucket.min && product.price < bucket.max);
      return matchesQuery && matchesCategory && matchesStatus && matchesPrice;
    });

    const value = SORT_VALUE[sort.key];
    const direction = sort.dir === "asc" ? 1 : -1;
    return result.sort((a, b) => (value(a) - value(b)) * direction);
  }, [products, filters, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const handleAction = (action: ProductAction, product: Product) => {
    switch (action) {
      case "view":
        router.push(`/admin/products/${product.id}`);
        break;
      case "edit":
        setEditing(product);
        break;
      case "duplicate": {
        const copy = duplicateProduct(product.id);
        if (copy) {
          toast({
            variant: "success",
            title: "Product duplicated",
            description: `Created “${copy.name}”.`,
          });
          router.push(`/admin/products/${copy.id}`);
        }
        break;
      }
      case "archive": {
        const nextStatus = product.status === "Active" ? "Archived" : "Active";
        toggleStatus(product.id);
        toast({
          title: nextStatus === "Active" ? "Product activated" : "Product deactivated",
          description: `${product.name} is now ${nextStatus.toLowerCase()}.`,
        });
        break;
      }
      case "delete":
        setPendingDelete(product);
        break;
    }
  };

  const handleEditSubmit = (values: ProductFormValues) => {
    if (!editing) return;
    updateProduct(editing.id, values);
    toast({
      variant: "success",
      title: "Product updated",
      description: `${values.name} has been saved.`,
    });
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteProduct(pendingDelete.id);
    toast({ title: "Product deleted", description: `${pendingDelete.name} was removed.` });
    setPendingDelete(null);
  };

  const rangeStart = filtered.length === 0 ? 0 : start + 1;
  const rangeEnd = start + pageItems.length;

  return (
    <>
      <Card className="p-4 sm:p-5">
        <ProductFilters
          filters={filters}
          view={view}
          onQueryChange={(value) => setFilter("query", value)}
          onCategoryChange={(value) => setFilter("category", value)}
          onStatusChange={(value) => setFilter("status", value)}
          onPriceChange={(value) => setFilter("price", value)}
          onSortChange={handleSelectSort}
          onViewChange={setView}
        />

        <div className="mt-5">
          {filtered.length === 0 ? (
            <ProductsEmpty onReset={resetFilters} />
          ) : view === "grid" ? (
            <div className={PRODUCT_GRID_CLASS}>
              {pageItems.map((product) => (
                <ProductCard key={product.id} product={product} onAction={handleAction} />
              ))}
            </div>
          ) : (
            <ProductTable
              products={pageItems}
              sort={sort}
              onSortChange={handleTableSort}
              onAction={handleAction}
            />
          )}
        </div>

        {filtered.length > 0 && (
          <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-border/70 pt-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">{rangeStart}</span>–
              <span className="font-medium text-foreground">{rangeEnd}</span> of{" "}
              <span className="font-medium text-foreground">
                {formatNumber(filtered.length)}
              </span>{" "}
              products
            </p>
            <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <ProductEditDialog
        open={editing !== null}
        mode="edit"
        product={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={handleEditSubmit}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        icon={<Trash2 />}
        title="Delete product"
        description={
          pendingDelete ? (
            <>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{pendingDelete.name}</span>?
              This action cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
