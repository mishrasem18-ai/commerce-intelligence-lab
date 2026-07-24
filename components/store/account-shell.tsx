"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, LogOut, MapPin, Package, User } from "lucide-react";
import { useAuth } from "@/lib/store/auth-store";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const NAV = [
  { title: "Overview", href: "/account", icon: LayoutGrid },
  { title: "My Orders", href: "/account/orders", icon: Package },
  { title: "Profile", href: "/account/profile", icon: User },
  { title: "Addresses", href: "/account/addresses", icon: MapPin },
];

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logoutBuyer } = useAuth();
  const { toast } = useToast();

  const isActive = (href: string) =>
    href === "/account" ? pathname === "/account" : pathname.startsWith(href);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
        My Account
      </h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.title}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              logoutBuyer();
              toast({ title: "Signed out", description: "You've been logged out." });
              router.push("/");
            }}
            className="flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="size-4" />
            Logout
          </button>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
