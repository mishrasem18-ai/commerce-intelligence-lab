"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { StoreBrand } from "@/components/store/store-brand";
import { StoreSearch } from "@/components/store/store-search";
import { CartButton } from "@/components/store/cart-button";
import { AccountMenu } from "@/components/store/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { CategoryNav } from "@/components/store/category-nav";

const MOBILE_DRAWER_ID = "store-mobile-drawer";

export function StoreHeader() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Portals need document; only render the drawer after mount.
  React.useEffect(() => setMounted(true), []);

  // While the drawer is open: lock background scroll and close on Escape.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const closeDrawer = () => setMobileOpen(false);

  // The mobile drawer is rendered through a portal on document.body rather than
  // inside <header>. The header uses backdrop-blur (a backdrop-filter), which
  // establishes a containing block for position:fixed descendants — a fixed
  // drawer nested in the header would be sized/positioned relative to the header
  // (~64px tall) instead of the viewport, overlapping page content. Portalling
  // to the body escapes that containing block so the overlay covers the page.
  const drawer =
    mounted && mobileOpen
      ? createPortal(
          <div className="fixed inset-0 z-[100] md:hidden">
            <div
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
              onClick={closeDrawer}
              aria-hidden
            />
            <div
              id={MOBILE_DRAWER_ID}
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto border-r border-border bg-card p-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <StoreBrand />
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={closeDrawer}
                  className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent"
                >
                  <X className="size-5" />
                </button>
              </div>
              <StoreSearch onNavigate={closeDrawer} />
              {/* Same component, same URL-derived active state as the desktop
                  bar — mobile cannot drift from desktop. */}
              <CategoryNav variant="stack" includeSecondary onNavigate={closeDrawer} />
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          aria-controls={MOBILE_DRAWER_ID}
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

      {/* Category nav (desktop/tablet) */}
      <div className="hidden border-t border-border/70 md:block">
        <CategoryNav variant="bar" />
      </div>

      {drawer}
    </header>
  );
}
