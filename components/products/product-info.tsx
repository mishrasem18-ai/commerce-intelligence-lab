import { Star } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/products/status-badge";
import { InventoryBadge } from "@/components/products/inventory-badge";
import { CATEGORY_ICON } from "@/components/products/category-visuals";
import type { Product } from "@/lib/data/products";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/utils";

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function ProductDescription({ product }: { product: Product }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Description</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </p>
      </CardContent>
    </Card>
  );
}

export function ProductPricingCard({ product }: { product: Product }) {
  const margin = product.price > 0 ? (product.price - product.cost) / product.price : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing &amp; Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between border-b border-border/70 pb-4">
          <div>
            <p className="text-xs text-muted-foreground">List price</p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
              {formatCurrency(product.price, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <InventoryBadge inventory={product.inventory} />
        </div>
        <dl className="divide-y divide-border/70">
          <Fact label="Unit cost">
            {formatCurrency(product.cost, { maximumFractionDigits: 2 })}
          </Fact>
          <Fact label="Margin">
            <span className="text-success-foreground">{formatPercent(margin)}</span>
          </Fact>
          <Fact label="Inventory">{formatNumber(product.inventory)} units</Fact>
          <Fact label="Revenue">{formatCurrency(product.revenue)}</Fact>
          <Fact label="Units sold">{formatNumber(product.unitsSold)}</Fact>
          <Fact label="Rating">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              {product.rating.toFixed(1)}
            </span>
          </Fact>
        </dl>
      </CardContent>
    </Card>
  );
}

export function ProductAttributesCard({ product }: { product: Product }) {
  const CategoryIcon = CATEGORY_ICON[product.category];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attributes</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border/70">
          <Fact label="SKU">
            <span className="font-mono text-xs">{product.sku}</span>
          </Fact>
          <Fact label="Brand">{product.brand}</Fact>
          <Fact label="Category">
            <span className="inline-flex items-center gap-1.5">
              <CategoryIcon className="size-4 text-muted-foreground" />
              {product.category}
            </span>
          </Fact>
          <Fact label="Status">
            <StatusBadge status={product.status} />
          </Fact>
          <Fact label="Created">{formatDate(product.createdAt)}</Fact>
          <Fact label="Updated">{formatDate(product.updatedAt)}</Fact>
        </dl>
      </CardContent>
    </Card>
  );
}
