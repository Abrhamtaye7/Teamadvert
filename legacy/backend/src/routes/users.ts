import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { userCreateSchema, userRoleUpdateSchema, userAccessUpdateSchema } from "../../../shared/schemas";

const router = Router();
router.use(requireAuth);
router.use(requireRole(["Admin"]));

const includeUserRelations = {
  role: true,
  accessGrants: { include: { accessRole: true } },
};

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { username: "asc" }, include: includeUserRelations });
  res.json(users);
});

router.get("/roles", async (_req, res) => {
  const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
  res.json(roles);
});

router.get("/access-roles", async (_req, res) => {
  const accessRoles = await prisma.accessRole.findMany({ orderBy: { label: "asc" } });
  res.json(accessRoles);
});

router.post("/", async (req, res) => {
  const parsed = userCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const { username, pin, roleId, accessRoleIds } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return res.status(409).json({ message: "Username already exists" });
  const pinHash = await bcrypt.hash(pin, 10);
  const user = await prisma.user.create({
    data: {
      username,
      pinHash,
      roleId,
    },
    include: includeUserRelations,
  });
  const grants = accessRoleIds && accessRoleIds.length ? accessRoleIds : (await prisma.accessRole.findMany()).map((access) => access.id);
  if (grants.length) {
    await prisma.userAccessRole.createMany({
      data: grants.map((accessRoleId) => ({ userId: user.id, accessRoleId })),
      skipDuplicates: true,
    });
  }
  const fresh = await prisma.user.findUnique({ where: { id: user.id }, include: includeUserRelations });
  res.status(201).json(fresh);
});

router.patch("/:id/role", async (req, res) => {
  const parsed = userRoleUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const id = Number(req.params.id);
  const user = await prisma.user.update({ where: { id }, data: { roleId: parsed.data.roleId }, include: includeUserRelations });
  res.json(user);
});

router.put("/:id/access", async (req, res) => {
  const parsed = userAccessUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const id = Number(req.params.id);
  const accessIds = parsed.data.accessRoleIds ?? [];
  await prisma.userAccessRole.deleteMany({ where: { userId: id } });
  if (accessIds.length) {
    await prisma.userAccessRole.createMany({ data: accessIds.map((accessRoleId) => ({ userId: id, accessRoleId })) });
  }
  const user = await prisma.user.findUnique({ where: { id }, include: includeUserRelations });
  res.json(user);
});

export default router;
