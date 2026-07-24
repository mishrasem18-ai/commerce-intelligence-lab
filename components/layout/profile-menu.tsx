"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  CreditCard,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/avatar";

const CURRENT_USER = {
  name: "Anurag Mishra",
  email: "anurag@commercelab.io",
  role: "Workspace Admin",
};

export function ProfileMenu() {
  const router = useRouter();
  const { toast } = useToast();
  const [signingOut, setSigningOut] = React.useState(false);

  const go = (href: string) => router.push(href);

  return (
    <>
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
              <p className="truncate text-sm font-semibold">{CURRENT_USER.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {CURRENT_USER.email}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => go("/settings?tab=profile")}>
            <User />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => go("/settings?tab=account")}>
            <ShieldCheck />
            Account Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => go("/settings?tab=workspace")}>
            <Building2 />
            Workspace Settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => go("/settings?tab=billing")}>
            <CreditCard />
            Billing
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => go("/ai-assistant")}>
            <LifeBuoy />
            Support
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setSigningOut(true)}
            className="text-danger-foreground hover:bg-danger/10 [&_svg]:text-danger"
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={signingOut}
        icon={<LogOut />}
        title="Sign out"
        description="This is a demo workspace — you'll be returned to the dashboard."
        confirmLabel="Sign out"
        onConfirm={() => {
          setSigningOut(false);
          toast({ title: "Signed out", description: "Demo session ended." });
          router.push("/");
        }}
        onCancel={() => setSigningOut(false)}
      />
    </>
  );
}
