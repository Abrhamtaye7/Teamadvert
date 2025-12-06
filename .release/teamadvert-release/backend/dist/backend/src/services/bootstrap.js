"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSeedData = ensureSeedData;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
const logger_1 = require("../utils/logger");
const defaultRoles = [
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
async function ensureSeedData() {
    for (const role of defaultRoles) {
        await prisma_1.prisma.role.upsert({
            where: { name: role.name },
            update: { permissions: role.permissions },
            create: { name: role.name, permissions: role.permissions },
        });
    }
    for (const access of defaultAccessRoles) {
        await prisma_1.prisma.accessRole.upsert({
            where: { code: access.code },
            update: { label: access.label, description: access.description },
            create: access,
        });
    }
    const userCount = await prisma_1.prisma.user.count();
    if (userCount === 0) {
        const adminRole = await prisma_1.prisma.role.findUnique({ where: { name: "Admin" } });
        if (!adminRole)
            return;
        const pinHash = await bcryptjs_1.default.hash("3805", 10);
        const admin = await prisma_1.prisma.user.create({
            data: {
                username: "admin",
                pinHash,
                roleId: adminRole.id,
            },
        });
        const accessRoles = await prisma_1.prisma.accessRole.findMany();
        await prisma_1.prisma.userAccessRole.createMany({
            data: accessRoles.map((access) => ({ userId: admin.id, accessRoleId: access.id })),
            skipDuplicates: true,
        });
        logger_1.log.info("Seeded default admin user (username: admin, PIN: 3805) - change immediately");
    }
}
