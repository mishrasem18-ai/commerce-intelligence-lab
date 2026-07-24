"use client";

import Link from "next/link";
import { CheckCircle2, PackageX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BuyerOrderBody } from "@/components/store/buyer-order-body";
import { useBuyerOrder } from "@/lib/hooks/use-buyer-order";
import { formatCurrency } from "@/lib/utils";

export function OrderConfirmationView({ slug }: { slug: string }) {
  const result = useBuyerOrder(slug);

  if (result.status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading order…
      </div>
    );
  }

  if (result.status !== "ok") {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <PackageX className="size-7" />
        </span>
        <h1 className="text-xl font-semibold text-foreground">Order not found</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t find this order for your account.
        </p>
        <Link href="/shop" className={buttonVariants({ variant: "outline" })}>
          Continue shopping
        </Link>
      </div>
    );
  }

  const { order } = result;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="size-8" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Order placed successfully
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Thank you! Your order{" "}
            <span className="font-medium text-foreground">{order.orderNumber}</span>{" "}
            for {formatCurrency(order.amount, { maximumFractionDigits: 2 })} is confirmed.
          </p>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link href="/shop" className={buttonVariants({ variant: "outline" })}>
            Continue Shopping
          </Link>
          <Link href="/account/orders" className={buttonVariants()}>
            View My Orders
          </Link>
        </div>
      </div>

      <BuyerOrderBody order={order} />
    </div>
  );
}
