import { Badge } from "@/components/ui/badge";
import { getInventoryState } from "@/lib/data/products";
import { cn, formatNumber } from "@/lib/utils";

export function InventoryBadge({
  inventory,
  className,
}: {
  inventory: number;
  className?: string;
}) {
  const state = getInventoryState(inventory);

  if (state === "out") {
    return (
      <Badge variant="danger" className={className}>
        Out of stock
      </Badge>
    );
  }

  if (state === "low") {
    return (
      <Badge variant="warning" className={className}>
        Low · {formatNumber(inventory)}
      </Badge>
    );
  }

  return (
    <Badge variant="neutral" className={cn("tabular-nums", className)}>
      {formatNumber(inventory)} in stock
    </Badge>
  );
}
