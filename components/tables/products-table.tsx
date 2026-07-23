import { Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/data";
import { formatCurrency, formatNumber } from "@/lib/utils";

function stock(stockValue: number) {
  if (stockValue === 0) return <Badge variant="danger">Out of stock</Badge>;
  if (stockValue < 50) return <Badge variant="warning">Low stock</Badge>;
  return <Badge variant="success">In stock</Badge>;
}

export function ProductsTable({ products }: { products: Product[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Product</TableHead>
          <TableHead className="hidden md:table-cell">Category</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Units</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Package className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {product.name}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {product.sku}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <Badge variant="neutral">{product.category}</Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {formatCurrency(product.price, { maximumFractionDigits: 2 })}
            </TableCell>
            <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
              {formatNumber(product.unitsSold)}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums text-foreground">
              {formatCurrency(product.revenue)}
            </TableCell>
            <TableCell>{stock(product.stock)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
