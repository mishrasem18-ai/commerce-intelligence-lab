"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ALL_CATEGORIES,
  PRIMARY_NAV_CATEGORIES,
  SECONDARY_NAV_CATEGORIES,
  resolveCategory,
  type CategorySelection,
} from "@/lib/catalog/categories";
import { categoryHref, SHOP_PATH } from "@/lib/catalog/shop-query";

/**
 * Which category the site navigation should highlight, derived from the URL —
 * the same single source of truth the shop grid filters on. Returns `null`
 * away from the shop, where no category is being browsed.
 *
 * Exported so the desktop bar and the mobile drawer share one implementation:
 * there is no way for the two layouts to highlight different categories.
 */
export function useActiveCategory(): CategorySelection | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname !== SHOP_PATH) return null;
  return resolveCategory(searchParams.get("category"));
}

interface CategoryNavProps {
  /** `"bar"` = horizontal desktop strip, `"stack"` = vertical mobile drawer. */
  variant: "bar" | "stack";
  /** Include the categories outside the primary nav (used by the drawer). */
  includeSecondary?: boolean;
  onNavigate?: () => void;
  className?: string;
}

export function CategoryNav({
  variant,
  includeSecondary = false,
  onNavigate,
  className,
}: CategoryNavProps) {
  const active = useActiveCategory();
  const isBar = variant === "bar";

  const entries: { key: string; href: string; label: string; selection: CategorySelection }[] = [
    {
      key: ALL_CATEGORIES,
      href: categoryHref(ALL_CATEGORIES),
      label: "All Products",
      selection: ALL_CATEGORIES,
    },
    ...PRIMARY_NAV_CATEGORIES.map((category) => ({
      key: category.id,
      href: categoryHref(category.id),
      label: category.name,
      selection: category.id as CategorySelection,
    })),
  ];

  const secondary = includeSecondary
    ? SECONDARY_NAV_CATEGORIES.map((category) => ({
        key: category.id,
        href: categoryHref(category.id),
        label: category.name,
        selection: category.id as CategorySelection,
      }))
    : [];

  const renderLink = (entry: (typeof entries)[number]) => {
    // "All Products" is active only when no specific category is selected.
    const isActive = active === entry.selection;
    return (
      <Link
        key={entry.key}
        href={entry.href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        data-category={entry.selection}
        data-active={isActive ? "true" : "false"}
        className={cn(
          "transition-colors",
          // The active underline is drawn with a background bar, not a border:
          // globals.css sets `* { border-color: var(--border) }` unlayered,
          // which outranks any `border-*` utility and would grey it out.
          isBar
            ? "relative px-3 py-2.5 text-sm after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors"
            : "rounded-lg px-3 py-2.5 text-sm",
          isActive
            ? isBar
              ? "font-semibold text-primary after:bg-primary"
              : "bg-accent font-semibold text-primary"
            : isBar
              ? "text-muted-foreground after:bg-transparent hover:text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        {entry.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Product categories"
      className={cn(
        isBar
          ? "mx-auto flex w-full max-w-7xl items-center gap-1 px-4 sm:px-6 lg:px-8"
          : "flex flex-col",
        className,
      )}
    >
      {entries.map(renderLink)}
      {secondary.length > 0 && (
        <>
          <span className="mt-3 px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
            More categories
          </span>
          {secondary.map(renderLink)}
        </>
      )}
    </nav>
  );
}
