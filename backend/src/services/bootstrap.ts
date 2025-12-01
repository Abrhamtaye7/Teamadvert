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

export async function ensureSeedData() {
  for (const role of defaultRoles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { permissions: role.permissions },
      create: { name: role.name, permissions: role.permissions },
    });
  }

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const adminRole = await prisma.role.findUnique({ where: { name: "Admin" } });
    if (!adminRole) return;
    const pinHash = await bcrypt.hash("0000", 10);
    await prisma.user.create({
      data: {
        username: "admin",
        pinHash,
        roleId: adminRole.id,
      },
    });
    log.info("Seeded default admin user (username: admin, PIN: 0000) - change immediately");
  }
}
