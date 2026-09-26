import Link from "next/link";
import {
  AnalyticsDebuggerLink,
  CookieSettingsLink,
} from "@/components/analytics/analytics-footer-links";
import { StoreBrand } from "@/components/store/store-brand";
import { PRIMARY_NAV_CATEGORIES } from "@/lib/catalog/categories";
import { categoryHref } from "@/lib/catalog/shop-query";

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
            {PRIMARY_NAV_CATEGORIES.map((category) => (
              <li key={category.id}>
                <Link
                  href={categoryHref(category.id)}
                  className="transition-colors hover:text-foreground"
                >
                  {category.name}
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
            <li>
              <CookieSettingsLink />
            </li>
            <li>
              <AnalyticsDebuggerLink />
            </li>
            <li>
              <Link href="/credits" className="transition-colors hover:text-foreground">
                Image credits
              </Link>
            </li>
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
