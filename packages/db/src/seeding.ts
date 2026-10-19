import { count, eq } from "drizzle-orm";
import type { Db } from "./client";
import { applyCounterStarts, COUNTER_STARTS } from "./counters";
import { hashPin, isValidPin } from "./pin";
import { accessRoles, roles, userAccessRoles, users, type Permissions } from "./schema";

// Ported from legacy/backend/src/services/bootstrap.ts
export const defaultRoles: { name: string; permissions: Permissions }[] = [
  { name: "Admin", permissions: { manageUsers: true, managePrices: true, approveJobs: true } },
  { name: "Finance", permissions: { verifyPayments: true, markPaid: true } },
  { name: "Sales", permissions: { manageCustomers: true, createProforma: true } },
  { name: "Designer", permissions: { createJobs: true } },
  { name: "Production", permissions: { updateProduction: true } },
];

export const defaultAccessRoles = [
  { code: "dashboard", label: "Dashboard", description: "View dashboard" },
  { code: "reports", label: "Reports", description: "View analytics reports" },
  { code: "jobs", label: "Job Orders", description: "Manage job orders" },
  { code: "proformas", label: "Proformas", description: "Manage proformas" },
  { code: "customers", label: "Customers", description: "Manage customers" },
  { code: "suppliers", label: "Suppliers", description: "Manage suppliers" },
  { code: "items", label: "Items", description: "Manage inventory items" },
  { code: "finance", label: "Finance", description: "Access finance tab" },
  { code: "notifications", label: "Notifications", description: "See notifications" },
  { code: "settings", label: "Settings", description: "Access settings" },
];

export type SeedResult = { adminCreated: boolean };

/**
 * Idempotent: sets the numbering start points (see COUNTER_STARTS), upserts roles and access roles. Creates the
 * first admin (with every access role) only when there are no users yet, which requires `adminPin`.
 */
export async function seedDatabase(
  db: Db,
  { adminPin, counterStarts = COUNTER_STARTS }: { adminPin?: string; counterStarts?: typeof COUNTER_STARTS } = {},
): Promise<SeedResult> {
  await applyCounterStarts(db, counterStarts);
  for (const role of defaultRoles) {
    await db
      .insert(roles)
      .values(role)
      .onConflictDoUpdate({ target: roles.name, set: { permissions: role.permissions } });
  }
  for (const access of defaultAccessRoles) {
    await db
      .insert(accessRoles)
      .values(access)
      .onConflictDoUpdate({ target: accessRoles.code, set: { label: access.label, description: access.description } });
  }

  const [{ total }] = await db.select({ total: count() }).from(users);
  if (total > 0) return { adminCreated: false };

  if (!adminPin || !isValidPin(adminPin)) {
    throw new Error("No users exist yet: set SEED_ADMIN_PIN to a 4-digit PIN to create the first admin.");
  }

  const pinHash = await hashPin(adminPin);
  await db.transaction(async (tx) => {
    const [adminRole] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.name, "Admin"));
    const [{ id: adminId }] = await tx
      .insert(users)
      .values({ username: "admin", pinHash, roleId: adminRole.id })
      .returning({ id: users.id });
    const allAccess = await tx.select({ id: accessRoles.id }).from(accessRoles);
    await tx.insert(userAccessRoles).values(allAccess.map(({ id }) => ({ userId: adminId, accessRoleId: id })));
  });
  return { adminCreated: true };
}
