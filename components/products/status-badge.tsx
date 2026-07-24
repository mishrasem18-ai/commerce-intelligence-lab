import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { ProductStatus } from "@/lib/data/products";
import { cn } from "@/lib/utils";

const config: Record<
  ProductStatus,
  { variant: BadgeProps["variant"]; dot: string }
> = {
  Active: { variant: "success", dot: "bg-success" },
  Draft: { variant: "warning", dot: "bg-warning" },
  Archived: { variant: "neutral", dot: "bg-muted-foreground" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: ProductStatus;
  className?: string;
}) {
  const { variant, dot } = config[status];
  return (
    <Badge variant={variant} className={className}>
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {status}
    </Badge>
  );
}
