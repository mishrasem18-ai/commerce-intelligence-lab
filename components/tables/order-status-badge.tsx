import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/data";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  OrderStatus,
  { variant: BadgeProps["variant"]; dot: string }
> = {
  Paid: { variant: "success", dot: "bg-success" },
  Shipped: { variant: "default", dot: "bg-primary" },
  Pending: { variant: "warning", dot: "bg-warning" },
  Refunded: { variant: "neutral", dot: "bg-muted-foreground" },
  Cancelled: { variant: "danger", dot: "bg-danger" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} className="gap-1.5">
      <span className={cn("size-1.5 rounded-full", config.dot)} />
      {status}
    </Badge>
  );
}
