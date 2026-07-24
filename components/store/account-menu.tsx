"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, LogOut, MapPin, Package, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

export function AccountMenu() {
  const router = useRouter();
  const { toast } = useToast();
  const { buyer, hydrated, logoutBuyer } = useAuth();

  // Server + first client render show the signed-out control, then update.
  if (!hydrated || !buyer) {
    return (
      <Link
        href="/login"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
      >
        <User className="size-4" />
        <span className="hidden sm:inline">Sign In</span>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-accent"
        >
          <Avatar name={buyer.name} size="sm" />
          <span className="hidden max-w-28 truncate pr-1 text-sm font-medium text-foreground sm:block">
            {buyer.name.split(" ")[0]}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-semibold text-foreground">
            {buyer.name}
          </span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {buyer.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/account")}>
          <LayoutGrid />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/account/orders")}>
          <Package />
          My Orders
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/account/profile")}>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/account/addresses")}>
          <MapPin />
          Addresses
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            logoutBuyer();
            toast({ title: "Signed out", description: "You've been logged out." });
            router.push("/");
          }}
          className="text-danger-foreground hover:bg-danger/10 [&_svg]:text-danger"
        >
          <LogOut />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
