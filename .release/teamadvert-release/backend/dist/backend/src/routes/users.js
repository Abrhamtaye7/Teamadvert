"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const schemas_1 = require("../../../shared/schemas");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.use((0, auth_1.requireRole)(["Admin"]));
const includeUserRelations = {
    role: true,
    accessGrants: { include: { accessRole: true } },
};
router.get("/", async (_req, res) => {
    const users = await prisma_1.prisma.user.findMany({ orderBy: { username: "asc" }, include: includeUserRelations });
    res.json(users);
});
router.get("/roles", async (_req, res) => {
    const roles = await prisma_1.prisma.role.findMany({ orderBy: { name: "asc" } });
    res.json(roles);
});
router.get("/access-roles", async (_req, res) => {
    const accessRoles = await prisma_1.prisma.accessRole.findMany({ orderBy: { label: "asc" } });
    res.json(accessRoles);
});
router.post("/", async (req, res) => {
    const parsed = schemas_1.userCreateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ issues: parsed.error.issues });
    const { username, pin, roleId, accessRoleIds } = parsed.data;
    const existing = await prisma_1.prisma.user.findUnique({ where: { username } });
    if (existing)
        return res.status(409).json({ message: "Username already exists" });
    const pinHash = await bcryptjs_1.default.hash(pin, 10);
    const user = await prisma_1.prisma.user.create({
        data: {
            username,
            pinHash,
            roleId,
        },
        include: includeUserRelations,
    });
    const grants = accessRoleIds && accessRoleIds.length ? accessRoleIds : (await prisma_1.prisma.accessRole.findMany()).map((access) => access.id);
    if (grants.length) {
        await prisma_1.prisma.userAccessRole.createMany({
            data: grants.map((accessRoleId) => ({ userId: user.id, accessRoleId })),
            skipDuplicates: true,
        });
    }
    const fresh = await prisma_1.prisma.user.findUnique({ where: { id: user.id }, include: includeUserRelations });
    res.status(201).json(fresh);
});
router.patch("/:id/role", async (req, res) => {
    const parsed = schemas_1.userRoleUpdateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ issues: parsed.error.issues });
    const id = Number(req.params.id);
    const user = await prisma_1.prisma.user.update({ where: { id }, data: { roleId: parsed.data.roleId }, include: includeUserRelations });
    res.json(user);
});
router.put("/:id/access", async (req, res) => {
    const parsed = schemas_1.userAccessUpdateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ issues: parsed.error.issues });
    const id = Number(req.params.id);
    const accessIds = parsed.data.accessRoleIds ?? [];
    await prisma_1.prisma.userAccessRole.deleteMany({ where: { userId: id } });
    if (accessIds.length) {
        await prisma_1.prisma.userAccessRole.createMany({ data: accessIds.map((accessRoleId) => ({ userId: id, accessRoleId })) });
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id }, include: includeUserRelations });
    res.json(user);
});
exports.default = router;
