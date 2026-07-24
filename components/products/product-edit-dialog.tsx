"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  type Product,
  type ProductCategory,
  type ProductStatus,
} from "@/lib/data/products";
import { cn } from "@/lib/utils";

export interface ProductFormValues {
  name: string;
  sku: string;
  brand: string;
  category: ProductCategory;
  price: number;
  inventory: number;
  status: ProductStatus;
}

interface ProductEditDialogProps {
  open: boolean;
  mode: "edit" | "create";
  product?: Product;
  onClose: () => void;
  onSubmit: (values: ProductFormValues) => void;
}

const categoryOptions = PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }));
const statusOptions = PRODUCT_STATUSES.map((s) => ({ value: s, label: s }));

interface DraftState {
  name: string;
  sku: string;
  brand: string;
  category: ProductCategory;
  price: string;
  inventory: string;
  status: ProductStatus;
}

function initialDraft(product?: Product): DraftState {
  return {
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    brand: product?.brand ?? "",
    category: product?.category ?? "Electronics",
    price: product ? String(product.price) : "",
    inventory: product ? String(product.inventory) : "",
    status: product?.status ?? "Draft",
  };
}

/**
 * Outer shell decides visibility; the form is keyed so it remounts (and
 * re-seeds its state) whenever it opens for a different product.
 */
export function ProductEditDialog({
  open,
  mode,
  product,
  onClose,
  onSubmit,
}: ProductEditDialogProps) {
  if (!open) return null;
  return (
    <ProductEditForm
      key={product?.id ?? "create"}
      mode={mode}
      product={product}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function ProductEditForm({
  mode,
  product,
  onClose,
  onSubmit,
}: Omit<ProductEditDialogProps, "open">) {
  const [draft, setDraft] = React.useState<DraftState>(() => initialDraft(product));
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const set = <K extends keyof DraftState>(key: K, value: DraftState[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!draft.name.trim()) nextErrors.name = "Name is required.";
    if (!draft.sku.trim()) nextErrors.sku = "SKU is required.";
    const price = Number(draft.price);
    const inventory = Number(draft.inventory);
    if (!Number.isFinite(price) || price < 0) nextErrors.price = "Enter a valid price.";
    if (!Number.isInteger(inventory) || inventory < 0)
      nextErrors.inventory = "Enter a valid inventory count.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit({
      name: draft.name.trim(),
      sku: draft.sku.trim(),
      brand: draft.brand.trim() || "Unbranded",
      category: draft.category,
      price,
      inventory,
      status: draft.status,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-edit-title"
    >
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <form
        onSubmit={handleSubmit}
        className="relative my-8 w-full max-w-lg animate-pop rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 sm:my-0"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="product-edit-title" className="text-base font-semibold tracking-tight">
            {mode === "create" ? "Add product" : "Edit product"}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
            className="text-muted-foreground"
          >
            <X />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
          <FormField label="Product name" error={errors.name} className="sm:col-span-2">
            <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Aurora Wireless Headphones" />
          </FormField>
          <FormField label="SKU" error={errors.sku}>
            <Input value={draft.sku} onChange={(e) => set("sku", e.target.value)} placeholder="AUR-WH-1000" className="font-mono" />
          </FormField>
          <FormField label="Brand">
            <Input value={draft.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Aurora" />
          </FormField>
          <FormField label="Category">
            <Select
              label="Category"
              value={draft.category}
              onValueChange={(v) => set("category", v as ProductCategory)}
              options={categoryOptions}
            />
          </FormField>
          <FormField label="Status">
            <Select
              label="Status"
              value={draft.status}
              onValueChange={(v) => set("status", v as ProductStatus)}
              options={statusOptions}
            />
          </FormField>
          <FormField label="Price (USD)" error={errors.price}>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draft.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="99.00"
            />
          </FormField>
          <FormField label="Inventory" error={errors.inventory}>
            <Input
              type="number"
              min="0"
              step="1"
              value={draft.inventory}
              onChange={(e) => set("inventory", e.target.value)}
              placeholder="120"
            />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            {mode === "create" ? "Create product" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
