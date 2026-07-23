"use client";

import {
  User,
  Settings,
  LifeBuoy,
  LogOut,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";

const CURRENT_USER = {
  name: "Anurag Mishra",
  email: "anurag@commercelab.io",
  role: "Workspace Admin",
};

export function ProfileMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button className="flex items-center gap-2 rounded-lg p-1 pr-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar name={CURRENT_USER.name} size="sm" />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-xs font-semibold text-foreground">
              {CURRENT_USER.name}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {CURRENT_USER.role}
            </span>
          </span>
          <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={CURRENT_USER.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {CURRENT_USER.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {CURRENT_USER.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem>
          <User />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CreditCard />
          Billing
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LifeBuoy />
          Support
        </DropdownMenuItem>
        <DropdownMenuItem className="text-danger-foreground hover:bg-danger/10 [&_svg]:text-danger">
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
