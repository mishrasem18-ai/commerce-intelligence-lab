"use client";

import * as React from "react";
import { type Product, type ProductStatus } from "@/lib/data/products";

const STORAGE_KEY = "cil.products.v1";

interface ProductsContextValue {
  products: Product[];
  hydrated: boolean;
  getProduct: (id: string) => Product | undefined;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  addProduct: (draft: Omit<Product, "id" | "createdAt" | "updatedAt">) => Product;
  duplicateProduct: (id: string) => Product | undefined;
  deleteProduct: (id: string) => void;
  toggleStatus: (id: string) => void;
  decrementInventory: (items: { productId: string; quantity: number }[]) => void;
}

const ProductsContext = React.createContext<ProductsContextValue | null>(null);

export function useProducts(): ProductsContextValue {
  const ctx = React.useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used within <ProductsProvider>");
  return ctx;
}

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `prod-new-${Date.now().toString(36)}-${idCounter}`;
}

function generateSku(name: string, existing: Set<string>): string {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .split("-")
      .map((part) => part.slice(0, 3))
      .join("-")
      .slice(0, 12) || "SKU";
  let candidate = `${base}-${1000 + existing.size}`;
  let n = 1;
  while (existing.has(candidate)) {
    candidate = `${base}-${1000 + existing.size + n}`;
    n += 1;
  }
  return candidate;
}

export function ProductsProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: Product[];
}) {
  // Authoritative catalog comes from D1 (server-provided `initial`). The static
  // array is no longer a runtime source.
  const [products, setProducts] = React.useState<Product[]>(initial);
  const [hydrated, setHydrated] = React.useState(false);
  // Ids present in D1. Anything else is a locally-created record (admin "add
  // product") kept in a localStorage overlay until write-through (Phase D).
  const d1Ids = React.useMemo(() => new Set(initial.map((p) => p.id)), [initial]);

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const overlay = (JSON.parse(raw) as Product[]).filter((p) => !d1Ids.has(p.id));
        if (overlay.length > 0) setProducts([...overlay, ...initial]);
      }
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist ONLY locally-created records (ids not in D1) — D1 stays authoritative.
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      const overlay = products.filter((p) => !d1Ids.has(p.id));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [products, hydrated, d1Ids]);

  const getProduct = React.useCallback(
    (id: string) => products.find((product) => product.id === id),
    [products],
  );

  const updateProduct = React.useCallback((id: string, patch: Partial<Product>) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === id
          ? { ...product, ...patch, updatedAt: new Date().toISOString() }
          : product,
      ),
    );
  }, []);

  const addProduct = React.useCallback(
    (draft: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const created: Product = { ...draft, id: generateId(), createdAt: now, updatedAt: now };
      setProducts((prev) => [created, ...prev]);
      return created;
    },
    [],
  );

  const duplicateProduct = React.useCallback(
    (id: string) => {
      const source = products.find((product) => product.id === id);
      if (!source) return undefined;
      const now = new Date().toISOString();
      const existingSkus = new Set(products.map((product) => product.sku));
      const copy: Product = {
        ...source,
        id: generateId(),
        sku: generateSku(`${source.name}-copy`, existingSkus),
        name: `${source.name} (Copy)`,
        status: "Draft",
        unitsSold: 0,
        revenue: 0,
        createdAt: now,
        updatedAt: now,
      };
      setProducts((prev) => {
        const index = prev.findIndex((product) => product.id === id);
        const next = [...prev];
        next.splice(index + 1, 0, copy);
        return next;
      });
      return copy;
    },
    [products],
  );

  const deleteProduct = React.useCallback((id: string) => {
    setProducts((prev) => prev.filter((product) => product.id !== id));
  }, []);

  const toggleStatus = React.useCallback((id: string) => {
    setProducts((prev) =>
      prev.map((product) => {
        if (product.id !== id) return product;
        const nextStatus: ProductStatus =
          product.status === "Active" ? "Archived" : "Active";
        return { ...product, status: nextStatus, updatedAt: new Date().toISOString() };
      }),
    );
  }, []);

  const decrementInventory = React.useCallback(
    (items: { productId: string; quantity: number }[]) => {
      setProducts((prev) =>
        prev.map((product) => {
          const line = items.find((item) => item.productId === product.id);
          if (!line) return product;
          return {
            ...product,
            inventory: Math.max(0, product.inventory - line.quantity),
            updatedAt: new Date().toISOString(),
          };
        }),
      );
    },
    [],
  );

  const value = React.useMemo<ProductsContextValue>(
    () => ({
      products,
      hydrated,
      getProduct,
      updateProduct,
      addProduct,
      duplicateProduct,
      deleteProduct,
      toggleStatus,
      decrementInventory,
    }),
    [
      products,
      hydrated,
      getProduct,
      updateProduct,
      addProduct,
      duplicateProduct,
      deleteProduct,
      toggleStatus,
      decrementInventory,
    ],
  );

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}
