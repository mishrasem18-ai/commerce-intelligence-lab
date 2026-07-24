"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2, Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useProducts } from "@/lib/store/products-store";
import type { Product } from "@/lib/data/products";

interface ProductDetailActionsProps {
  product: Product;
  onEdit: () => void;
}

export function ProductDetailActions({ product, onEdit }: ProductDetailActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { duplicateProduct, toggleStatus, deleteProduct } = useProducts();
  const [confirming, setConfirming] = React.useState(false);

  const handleDuplicate = () => {
    const copy = duplicateProduct(product.id);
    if (copy) {
      toast({
        variant: "success",
        title: "Product duplicated",
        description: `Created “${copy.name}”.`,
      });
      router.push(`/products/${copy.id}`);
    }
  };

  const handleToggle = () => {
    const nextStatus = product.status === "Active" ? "Archived" : "Active";
    toggleStatus(product.id);
    toast({
      title: nextStatus === "Active" ? "Product activated" : "Product deactivated",
      description: `${product.name} is now ${nextStatus.toLowerCase()}.`,
    });
  };

  const confirmDelete = () => {
    deleteProduct(product.id);
    setConfirming(false);
    toast({ title: "Product deleted", description: `${product.name} was removed.` });
    router.push("/products");
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={handleDuplicate}
        >
          <Copy />
          Duplicate
        </Button>
        <DropdownMenu align="end">
          <DropdownMenuTrigger>
            <Button variant="outline" size="icon-sm" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="sm:hidden" onSelect={handleDuplicate}>
              <Copy />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleToggle}>
              {product.status === "Active" ? <Archive /> : <CheckCircle2 />}
              {product.status === "Active" ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setConfirming(true)}
              className="text-danger hover:bg-danger/10 focus:bg-danger/10 [&_svg]:text-danger"
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={confirming}
        tone="danger"
        icon={<Trash2 />}
        title="Delete product"
        description={
          <>
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">{product.name}</span>?
            This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
