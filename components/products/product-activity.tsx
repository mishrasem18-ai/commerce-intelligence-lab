import {
  CircleDot,
  Package,
  PlusCircle,
  Star,
  Tag,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getProductActivity,
  type ActivityType,
  type Product,
} from "@/lib/data/products";
import { formatDate } from "@/lib/utils";

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  created: PlusCircle,
  price: Tag,
  inventory: Package,
  status: CircleDot,
  milestone: TrendingUp,
  review: Star,
};

export function ProductActivity({ product }: { product: Product }) {
  const events = getProductActivity(product);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative flex flex-col">
          {events.map((event, index) => {
            const Icon = ACTIVITY_ICON[event.type];
            const isLast = index === events.length - 1;
            return (
              <li key={event.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  {!isLast && <span className="w-px flex-1 bg-border" />}
                </div>
                <div className={isLast ? "pb-0" : "pb-6"}>
                  <p className="text-sm font-medium text-foreground">
                    {event.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{event.detail}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/80">
                    {formatDate(event.date)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
