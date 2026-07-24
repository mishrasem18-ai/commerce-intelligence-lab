"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, PackageX } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ProductHeader } from "@/components/products/product-header";
import { ProductGallery } from "@/components/products/product-gallery";
import { ProductActivity } from "@/components/products/product-activity";
import {
  ProductAttributesCard,
  ProductDescription,
  ProductPricingCard,
} from "@/components/products/product-info";
import {
  ProductEditDialog,
  type ProductFormValues,
} from "@/components/products/product-edit-dialog";
import { useProducts } from "@/lib/store/products-store";
import type { Product } from "@/lib/data/products";

interface ProductDetailViewProps {
  id: string;
  /** Server-provided product for statically known ids (avoids a load flash). */
  initialProduct: Product | null;
}

export function ProductDetailView({ id, initialProduct }: ProductDetailViewProps) {
  const { getProduct, updateProduct, hydrated } = useProducts();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);

  const product = getProduct(id) ?? initialProduct ?? null;

  const handleEditSubmit = (values: ProductFormValues) => {
    if (!product) return;
    updateProduct(product.id, values);
    toast({
      variant: "success",
      title: "Product updated",
      description: `${values.name} has been saved.`,
    });
    setEditing(false);
  };

  // A duplicated product lives only in the client store; wait for hydration
  // before deciding an id is genuinely missing.
  if (!product) {
    if (!hydrated) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading product…
        </div>
      );
    }
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <PackageX className="size-8" />
        </span>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Product not found
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            The product you&apos;re looking for doesn&apos;t exist or may have been
            removed from the catalog.
          </p>
        </div>
        <Link href="/products" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft />
          Back to Products
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <ProductHeader product={product} onEdit={() => setEditing(true)} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Media</CardTitle>
              </CardHeader>
              <CardContent>
                <ProductGallery product={product} />
              </CardContent>
            </Card>
            <ProductDescription product={product} />
            <ProductActivity product={product} />
          </div>

          <div className="flex flex-col gap-6">
            <ProductPricingCard product={product} />
            <ProductAttributesCard product={product} />
          </div>
        </div>
      </div>

      <ProductEditDialog
        open={editing}
        mode="edit"
        product={product}
        onClose={() => setEditing(false)}
        onSubmit={handleEditSubmit}
      />
    </>
  );
}
