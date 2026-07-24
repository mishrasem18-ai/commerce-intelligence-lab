import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductsEmptyProps {
  onReset?: () => void;
}

export function ProductsEmpty({ onReset }: ProductsEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <PackageSearch className="size-7" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">No products found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          No products match your current search and filters. Try adjusting or
          clearing them to see more results.
        </p>
      </div>
      {onReset && (
        <Button variant="outline" size="sm" onClick={onReset}>
          Clear all filters
        </Button>
      )}
    </div>
  );
}
