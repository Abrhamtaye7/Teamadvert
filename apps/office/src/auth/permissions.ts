import type { SessionUser } from "../lib/types";
import { useSession } from "./session";

/** Mirrors the API's role checks, so the UI only offers actions the server will accept. */
const PERMISSIONS = {
  "customer.edit": ["Admin", "Sales"],
  "supplier.edit": ["Admin", "Sales", "Finance"],
  "item.edit": ["Admin", "Sales", "Finance"],
  "proforma.create": ["Admin", "Sales", "Designer"],
  "proforma.edit": ["Admin", "Sales"],
  "proforma.approve": ["Admin"],
  "proforma.convert": ["Admin", "Sales", "Designer"],
  "job.create": ["Admin", "Designer", "Sales"],
  "job.approve": ["Admin"],
  "job.production": ["Production", "Admin"],
  "job.finance": ["Finance", "Admin"],
  "payment.record": ["Finance", "Admin"],
  "users.manage": ["Admin"],
  "backups.run": ["Admin"],
} as const;

type Permission = keyof typeof PERMISSIONS;

export const can = (user: SessionUser | null, permission: Permission) =>
  !!user && (PERMISSIONS[permission] as readonly string[]).includes(user.role);

export function useCan() {
  const user = useSession((s) => s.user);
  return (permission: Permission) => can(user, permission);
}

/** Access-role codes (granted per user by Admin) gate which sections appear in the navigation. */
export const hasAccess = (user: SessionUser | null, code: string) => !user?.access || user.access.includes(code);
