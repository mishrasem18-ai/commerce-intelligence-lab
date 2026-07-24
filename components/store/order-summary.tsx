import type { OrderTotals } from "@/lib/commerce";
import { formatCurrency } from "@/lib/utils";

export function OrderSummary({ totals }: { totals: OrderTotals }) {
  return (
    <dl className="flex flex-col gap-2.5 text-sm">
      <Row label="Subtotal" value={formatCurrency(totals.subtotal, { maximumFractionDigits: 2 })} />
      <Row label="Tax (8%)" value={formatCurrency(totals.tax, { maximumFractionDigits: 2 })} />
      <Row
        label="Shipping"
        value={
          totals.shipping === 0
            ? "Free"
            : formatCurrency(totals.shipping, { maximumFractionDigits: 2 })
        }
      />
      <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
        <dt className="text-base font-semibold text-foreground">Total</dt>
        <dd className="text-base font-semibold tabular-nums text-foreground">
          {formatCurrency(totals.total, { maximumFractionDigits: 2 })}
        </dd>
      </div>
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
