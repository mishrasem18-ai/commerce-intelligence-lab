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
      { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { title: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { title: "Reports", href: "/admin/reports", icon: FileText },
    ],
  },
  {
    label: "Commerce",
    items: [
      { title: "Products", href: "/admin/products", icon: Package },
      { title: "Orders", href: "/admin/orders", icon: ShoppingCart, badge: "12" },
      { title: "Customers", href: "/admin/customers", icon: Users },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "AI Assistant", href: "/admin/ai-assistant", icon: Sparkles, badge: "New" },
      { title: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

/** Flattened lookup for page headers / breadcrumbs. */
export const navItems: NavItem[] = navSections.flatMap((s) => s.items);
