"use client";

import {
  Archive,
  CheckCircle2,
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/data/products";
import { cn } from "@/lib/utils";

export type ProductAction = "view" | "edit" | "duplicate" | "archive" | "delete";

interface ProductActionsMenuProps {
  product: Product;
  onAction: (action: ProductAction, product: Product) => void;
  align?: "start" | "end";
  triggerClassName?: string;
}

export function ProductActionsMenu({
  product,
  onAction,
  align = "end",
  triggerClassName,
}: ProductActionsMenuProps) {
  return (
    <DropdownMenu align={align}>
      <DropdownMenuTrigger>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${product.name}`}
          className={cn("text-muted-foreground", triggerClassName)}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onAction("view", product)}>
          <Eye />
          View details
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("edit", product)}>
          <Pencil />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("duplicate", product)}>
          <Copy />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("archive", product)}>
          {product.status === "Active" ? <Archive /> : <CheckCircle2 />}
          {product.status === "Active" ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => onAction("delete", product)}
          className="text-danger hover:bg-danger/10 focus:bg-danger/10 [&_svg]:text-danger"
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
