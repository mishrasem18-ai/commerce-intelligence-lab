import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  FileText,
  Sparkles,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      { title: "Analytics", href: "/analytics", icon: BarChart3 },
      { title: "Reports", href: "/reports", icon: FileText },
    ],
  },
  {
    label: "Commerce",
    items: [
      { title: "Products", href: "/products", icon: Package },
      { title: "Orders", href: "/orders", icon: ShoppingCart, badge: "12" },
      { title: "Customers", href: "/customers", icon: Users },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "AI Assistant", href: "/ai-assistant", icon: Sparkles, badge: "New" },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Flattened lookup for page headers / breadcrumbs. */
export const navItems: NavItem[] = navSections.flatMap((s) => s.items);
