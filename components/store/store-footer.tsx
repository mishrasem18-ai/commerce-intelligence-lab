import Link from "next/link";
import { StoreBrand } from "@/components/store/store-brand";
import { PRODUCT_CATEGORIES } from "@/lib/data/products";

export function StoreFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-muted/30">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="col-span-2 md:col-span-1">
          <StoreBrand />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            A modern demo storefront powered by the Commerce Intelligence platform.
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-foreground">Shop</p>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {PRODUCT_CATEGORIES.slice(0, 5).map((category) => (
              <li key={category}>
                <Link
                  href={`/shop?category=${encodeURIComponent(category)}`}
                  className="transition-colors hover:text-foreground"
                >
                  {category}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-foreground">Account</p>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li>
              <Link href="/account" className="transition-colors hover:text-foreground">
                My Account
              </Link>
            </li>
            <li>
              <Link href="/account/orders" className="transition-colors hover:text-foreground">
                My Orders
              </Link>
            </li>
            <li>
              <Link href="/cart" className="transition-colors hover:text-foreground">
                Cart
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-foreground">Help</p>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li>Shipping &amp; Returns</li>
            <li>Contact Us</li>
            <li>FAQ</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/70">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
          © 2026 Aurora Market. Demo storefront — no real purchases are processed.
        </div>
      </div>
    </footer>
  );
}
