import {
  BarChart3,
  Inbox,
  Bell,
  Briefcase,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { hasAccess } from "../auth/permissions";
import type { SessionUser } from "../lib/types";

export type NavItem = {
  to: string;
  label: string;
  /** Label in the phone bottom bar (space is tight) */
  short?: string;
  icon: LucideIcon;
  /** Access-role code required to see it (none = always) */
  access?: string;
  /** Only these roles see it (mirrors the API) */
  roles?: string[];
  /** Shown in the phone bottom bar (the rest go under "More") */
  primary?: boolean;
  end?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard, access: "dashboard", primary: true, end: true },
  { to: "/proformas", label: "Proformas", icon: FileText, access: "proformas", primary: true },
  { to: "/jobs", label: "Job orders", short: "Jobs", icon: Briefcase, access: "jobs", primary: true },
  { to: "/finance", label: "Finance", icon: Wallet, access: "finance", primary: true },
  { to: "/leads", label: "Quote requests", icon: Inbox, access: "customers", roles: ["Admin", "Sales"] },
  { to: "/customers", label: "Customers", icon: Users, access: "customers" },
  { to: "/suppliers", label: "Suppliers", icon: Truck, access: "suppliers" },
  { to: "/items", label: "Items & prices", icon: Package, access: "items" },
  { to: "/reports", label: "Reports", icon: BarChart3, access: "reports" },
  { to: "/notifications", label: "Notifications", icon: Bell, access: "notifications" },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const visibleNav = (user: SessionUser | null) =>
  NAV.filter((item) => (!item.access || hasAccess(user, item.access)) && (!item.roles || (!!user && item.roles.includes(user.role))));
