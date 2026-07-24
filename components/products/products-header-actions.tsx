"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  ProductEditDialog,
  type ProductFormValues,
} from "@/components/products/product-edit-dialog";
import { useProducts } from "@/lib/store/products-store";
import { downloadCsv } from "@/lib/export-csv";
import type { Product } from "@/lib/data/products";

const CSV_COLUMNS = [
  { header: "ID", value: (p: Product) => p.id },
  { header: "SKU", value: (p: Product) => p.sku },
  { header: "Name", value: (p: Product) => p.name },
  { header: "Brand", value: (p: Product) => p.brand },
  { header: "Category", value: (p: Product) => p.category },
  { header: "Price", value: (p: Product) => p.price },
  { header: "Cost", value: (p: Product) => p.cost },
  { header: "Inventory", value: (p: Product) => p.inventory },
  { header: "Status", value: (p: Product) => p.status },
  { header: "Rating", value: (p: Product) => p.rating },
  { header: "Units Sold", value: (p: Product) => p.unitsSold },
  { header: "Revenue", value: (p: Product) => p.revenue },
];

export function ProductsHeaderActions() {
  const router = useRouter();
  const { toast } = useToast();
  const { products, addProduct } = useProducts();
  const [creating, setCreating] = React.useState(false);

  const handleExport = () => {
    downloadCsv("products", products, CSV_COLUMNS);
    toast({
      variant: "success",
      title: "Export ready",
      description: `${products.length} products exported to CSV.`,
    });
  };

  const handleCreate = (values: ProductFormValues) => {
    const created = addProduct({
      ...values,
      description: `${values.name} — added to the catalog.`,
      cost: Math.round(values.price * 0.5 * 100) / 100,
      rating: 4.5,
      image: `https://picsum.photos/seed/${encodeURIComponent(values.sku)}/640/640`,
      unitsSold: 0,
      revenue: 0,
    });
    setCreating(false);
    toast({
      variant: "success",
      title: "Product created",
      description: `${created.name} was added to your catalog.`,
    });
    router.push(`/products/${created.id}`);
  };

  return (
    <>
      <Button variant="outline" onClick={handleExport}>
        <Download />
        Export
      </Button>
      <Button onClick={() => setCreating(true)}>
        <Plus />
        Add Product
      </Button>

      <ProductEditDialog
        open={creating}
        mode="create"
        onClose={() => setCreating(false)}
        onSubmit={handleCreate}
      />
    </>
  );
}
