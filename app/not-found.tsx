import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Compass className="size-8" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been
          moved. Check the URL or head back home.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href="/" className={buttonVariants({ variant: "primary" })}>
          <Home />
          Back to Home
        </Link>
        <Link
          href="/shop"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Browse Shop
        </Link>
      </div>
    </div>
  );
}
