import { asc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import {
  userAccessUpdateSchema,
  userCreateSchema,
  userPinResetSchema,
  userRoleUpdateSchema,
  userStatusSchema,
} from "@teamadvert/shared/schemas";
import { accessRoles, hashPin, roles, userAccessRoles, users, type Db, type Executor } from "@teamadvert/db";
import { recordAudit } from "../lib/audit";
import { ApiError, badRequest, idParam, notFound, readJson } from "../lib/errors";
import { deleteUserSessions } from "../lib/sessions";
import { requireAuth, requireRole } from "../middleware/auth";
import { ROLES, type AppEnv } from "../types";

/** Users in the legacy response shape ({ role, accessGrants: [{ accessRole }] }), never including pinHash. */
async function loadUsers(db: Db, ids?: number[]) {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      roleId: users.roleId,
      isActive: users.isActive,
      lockedUntil: users.lockedUntil,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      role: { id: roles.id, name: roles.name, permissions: roles.permissions },
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(ids ? inArray(users.id, ids) : undefined)
    .orderBy(asc(users.username));
  if (!rows.length) return [];

  const grants = await db
    .select({
      id: userAccessRoles.id,
      userId: userAccessRoles.userId,
      accessRoleId: userAccessRoles.accessRoleId,
      granted: userAccessRoles.granted,
      accessRole: {
        id: accessRoles.id,
        code: accessRoles.code,
        label: accessRoles.label,
        description: accessRoles.description,
      },
    })
    .from(userAccessRoles)
    .innerJoin(accessRoles, eq(accessRoles.id, userAccessRoles.accessRoleId))
    .where(
      inArray(
        userAccessRoles.userId,
        rows.map((r) => r.id),
      ),
    );
  return rows.map((user) => ({ ...user, accessGrants: grants.filter((g) => g.userId === user.id) }));
}

async function loadUser(db: Db, id: number) {
  const [user] = await loadUsers(db, [id]);
  if (!user) throw notFound("User");
  return user;
}

async function assertRoleExists(db: Executor, roleId: number) {
  const [role] = await db.select({ id: roles.id, name: roles.name }).from(roles).where(eq(roles.id, roleId));
  if (!role) throw badRequest("Unknown role");
  return role;
}

async function assertAccessRolesExist(db: Executor, ids: number[]) {
  if (!ids.length) return;
  const found = await db.select({ id: accessRoles.id }).from(accessRoles).where(inArray(accessRoles.id, ids));
  if (found.length !== new Set(ids).size) throw badRequest("Unknown access role");
}

async function assertUserExists(db: Executor, id: number) {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id));
  if (!row) throw notFound("User");
}

export const userRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireRole(ROLES.Admin))

  .get("/", async (c) => c.json(await loadUsers(c.var.db)))

  .get("/roles", async (c) => c.json(await c.var.db.select().from(roles).orderBy(asc(roles.name))))

  .get("/access-roles", async (c) => c.json(await c.var.db.select().from(accessRoles).orderBy(asc(accessRoles.label))))

  .post("/", async (c) => {
    const { db, user: actor } = c.var;
    const input = await readJson(c, userCreateSchema);
    const { pin, roleId, accessRoleIds } = input;
    const username = input.username.trim();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.username})`, username.toLowerCase()));
    if (existing) throw new ApiError(409, "Username already exists");
    await assertRoleExists(db, roleId);
    // Legacy behaviour: no access roles given means all of them
    const grants = accessRoleIds?.length
      ? accessRoleIds
      : (await db.select({ id: accessRoles.id }).from(accessRoles)).map((a) => a.id);
    await assertAccessRolesExist(db, grants);

    const pinHash = await hashPin(pin);
    const id = await db.transaction(async (tx) => {
      const [{ id }] = await tx.insert(users).values({ username, pinHash, roleId }).returning({ id: users.id });
      if (grants.length) {
        await tx.insert(userAccessRoles).values([...new Set(grants)].map((accessRoleId) => ({ userId: id, accessRoleId })));
      }
      await recordAudit(tx, { userId: actor.id, entity: "user", entityId: id, action: "create", after: { username, roleId, grants } });
      return id;
    });
    return c.json(await loadUser(db, id), 201);
  })

  .patch("/:id/role", async (c) => {
    const { db, user: actor } = c.var;
    const id = idParam(c);
    const { roleId } = await readJson(c, userRoleUpdateSchema);
    await assertUserExists(db, id);
    const role = await assertRoleExists(db, roleId);
    if (id === actor.id && role.name !== ROLES.Admin) throw badRequest("You can't remove your own Admin role");
    await db.update(users).set({ roleId }).where(eq(users.id, id));
    await recordAudit(db, { userId: actor.id, entity: "user", entityId: id, action: "role", after: { roleId } });
    return c.json(await loadUser(db, id));
  })

  .put("/:id/access", async (c) => {
    const { db, user: actor } = c.var;
    const id = idParam(c);
    const accessIds = [...new Set((await readJson(c, userAccessUpdateSchema)).accessRoleIds ?? [])];
    await assertUserExists(db, id);
    await assertAccessRolesExist(db, accessIds);
    await db.transaction(async (tx) => {
      await tx.delete(userAccessRoles).where(eq(userAccessRoles.userId, id));
      if (accessIds.length) {
        await tx.insert(userAccessRoles).values(accessIds.map((accessRoleId) => ({ userId: id, accessRoleId })));
      }
      await recordAudit(tx, { userId: actor.id, entity: "user", entityId: id, action: "access", after: { accessIds } });
    });
    return c.json(await loadUser(db, id));
  })

  .post("/:id/reset-pin", async (c) => {
    const { db, user: actor } = c.var;
    const id = idParam(c);
    const { pin } = await readJson(c, userPinResetSchema);
    await assertUserExists(db, id);
    await db
      .update(users)
      .set({ pinHash: await hashPin(pin), failedAttempts: 0, lockedUntil: null })
      .where(eq(users.id, id));
    await deleteUserSessions(db, id);
    await recordAudit(db, { userId: actor.id, entity: "user", entityId: id, action: "reset-pin" });
    return c.json({ message: "PIN reset" });
  })

  .patch("/:id/status", async (c) => {
    const { db, user: actor } = c.var;
    const id = idParam(c);
    const { isActive } = await readJson(c, userStatusSchema);
    if (id === actor.id && !isActive) throw badRequest("You can't deactivate yourself");
    await assertUserExists(db, id);
    await db.update(users).set({ isActive }).where(eq(users.id, id));
    if (!isActive) await deleteUserSessions(db, id);
    await recordAudit(db, { userId: actor.id, entity: "user", entityId: id, action: isActive ? "activate" : "deactivate" });
    return c.json(await loadUser(db, id));
  });
