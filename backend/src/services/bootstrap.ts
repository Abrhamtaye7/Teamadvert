import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { log } from "../utils/logger";

const defaultRoles: { name: string; permissions: Record<string, boolean> }[] = [
  { name: "Admin", permissions: { manageUsers: true, managePrices: true, approveJobs: true } },
  { name: "Finance", permissions: { verifyPayments: true, markPaid: true } },
  { name: "Sales", permissions: { manageCustomers: true, createProforma: true } },
  { name: "Designer", permissions: { createJobs: true } },
  { name: "Production", permissions: { updateProduction: true } },
];

const defaultAccessRoles = [
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

export async function ensureSeedData() {
  for (const role of defaultRoles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { permissions: role.permissions },
      create: { name: role.name, permissions: role.permissions },
    });
  }

  for (const access of defaultAccessRoles) {
    await prisma.accessRole.upsert({
      where: { code: access.code },
      update: { label: access.label, description: access.description },
      create: access,
    });
  }

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const adminRole = await prisma.role.findUnique({ where: { name: "Admin" } });
    if (!adminRole) return;
    const pinHash = await bcrypt.hash("3805", 10);
    const admin = await prisma.user.create({
      data: {
        username: "admin",
        pinHash,
        roleId: adminRole.id,
      },
    });
    const accessRoles = await prisma.accessRole.findMany();
    await prisma.userAccessRole.createMany({
      data: accessRoles.map((access) => ({ userId: admin.id, accessRoleId: access.id })),
      skipDuplicates: true,
    });
    log.info("Seeded default admin user (username: admin, PIN: 3805) - change immediately");
  }
}
