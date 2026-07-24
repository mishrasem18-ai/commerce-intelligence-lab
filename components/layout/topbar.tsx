"use client";

import * as React from "react";
import { Menu, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);

  React.useEffect(() => {
    if (!mobileSearchOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileSearchOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileSearchOpen]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        onClick={onMenuClick}
        className="text-muted-foreground lg:hidden"
      >
        <Menu />
      </Button>

      <div className="hidden flex-1 md:block md:max-w-md">
        <GlobalSearch />
      </div>

      <div className="flex-1 md:hidden" />

      <div className="flex items-center gap-1 sm:gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          onClick={() => setMobileSearchOpen(true)}
          className="text-muted-foreground md:hidden"
        >
          <Search />
        </Button>
        <NotificationsMenu />
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
        <ProfileMenu />
      </div>

      {mobileSearchOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 p-4 backdrop-blur-sm md:hidden">
          <div className="flex items-center gap-2">
            <GlobalSearch
              autoFocus
              className="flex-1"
              onNavigate={() => setMobileSearchOpen(false)}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close search"
              onClick={() => setMobileSearchOpen(false)}
              className="text-muted-foreground"
            >
              <X />
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
