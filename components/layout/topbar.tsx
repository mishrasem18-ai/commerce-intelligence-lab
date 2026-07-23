"use client";

import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/layout/search-box";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
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
        <SearchBox />
      </div>

      <div className="flex-1 md:hidden" />

      <div className="flex items-center gap-1 sm:gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          className="text-muted-foreground md:hidden"
        >
          <Search />
        </Button>
        <NotificationsMenu />
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
        <ProfileMenu />
      </div>
    </header>
  );
}
