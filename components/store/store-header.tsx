"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { StoreBrand } from "@/components/store/store-brand";
import { StoreSearch } from "@/components/store/store-search";
import { CartButton } from "@/components/store/cart-button";
import { AccountMenu } from "@/components/store/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { PRODUCT_CATEGORIES } from "@/lib/data/products";
import { cn } from "@/lib/utils";

const NAV_CATEGORIES = ["Electronics", "Fashion", "Home", "Gaming", "Beauty", "Sports"];

export function StoreHeader() {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent md:hidden"
        >
          <Menu className="size-5" />
        </button>

        <StoreBrand />

        <div className="ml-2 hidden flex-1 md:block md:max-w-lg">
          <StoreSearch />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <AccountMenu />
          <CartButton />
        </div>
      </div>

      {/* Category nav (desktop) */}
      <nav className="hidden border-t border-border/70 md:block">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-1 px-4 sm:px-6 lg:px-8">
          <Link
            href="/shop"
            className="px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            All Products
          </Link>
          {NAV_CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/shop?category=${encodeURIComponent(category)}`}
              className="px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {category}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-4 border-r border-border bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <StoreBrand />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
              >
                <X className="size-5" />
              </button>
            </div>
            <StoreSearch onNavigate={() => setMobileOpen(false)} />
            <nav className="flex flex-col">
              <Link
                href="/shop"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
              >
                All Products
              </Link>
              {PRODUCT_CATEGORIES.map((category) => (
                <Link
                  key={category}
                  href={`/shop?category=${encodeURIComponent(category)}`}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent",
                  )}
                >
                  {category}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
