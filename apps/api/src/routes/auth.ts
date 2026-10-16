import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { changePinSchema, userLoginSchema } from "@teamadvert/shared/schemas";
import { accessRoles, hashPin, loginLogs, roles, userAccessRoles, users, verifyPin, type Db } from "@teamadvert/db";
import { recordAudit } from "../lib/audit";
import { ApiError, badRequest, readJson } from "../lib/errors";
import { clientIp } from "../lib/request";
import { createSession, deleteSession, deleteUserSessions, SESSION_COOKIE } from "../lib/sessions";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

const INVALID_LOGIN = "Invalid username or PIN";

async function accessCodes(db: Db, userId: number) {
  const rows = await db
    .select({ code: accessRoles.code })
    .from(userAccessRoles)
    .innerJoin(accessRoles, eq(accessRoles.id, userAccessRoles.accessRoleId))
    .where(and(eq(userAccessRoles.userId, userId), eq(userAccessRoles.granted, true)));
  return rows.map((r) => r.code);
}

export const authRoutes = new Hono<AppEnv>()
  .post("/login", async (c) => {
    const { db, config, loginLimiter } = c.var;
    const ip = clientIp(c);
    const retryAfter = loginLimiter.hit(ip ?? "unknown");
    if (retryAfter) {
      c.header("Retry-After", String(retryAfter));
      throw new ApiError(429, "Too many login attempts. Try again later.");
    }

    const parsed = userLoginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw badRequest("Invalid credentials");
    const { username, pin } = parsed.data;

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        pinHash: users.pinHash,
        isActive: users.isActive,
        failedAttempts: users.failedAttempts,
        lockedUntil: users.lockedUntil,
        role: roles.name,
        permissions: roles.permissions,
      })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(eq(users.username, username));
    if (!user || !user.isActive) throw new ApiError(401, INVALID_LOGIN);

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
      throw new ApiError(423, `Too many wrong PINs. Account locked for ${minutes} more minute(s).`);
    }

    if (!(await verifyPin(pin, user.pinHash))) {
      const attempts = user.failedAttempts + 1;
      const locked = attempts >= MAX_FAILED_ATTEMPTS;
      await db
        .update(users)
        .set(
          locked
            ? { failedAttempts: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000) }
            : { failedAttempts: attempts },
        )
        .where(eq(users.id, user.id));
      if (locked) await recordAudit(db, { userId: user.id, entity: "auth", action: "locked", after: { ip } });
      throw new ApiError(401, INVALID_LOGIN);
    }

    const userAgent = c.req.header("user-agent");
    await db
      .update(users)
      .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: now, lastLoginIp: ip, lastLoginAgent: userAgent?.slice(0, 512) })
      .where(eq(users.id, user.id));
    await db.insert(loginLogs).values({ userId: user.id, ip, userAgent: userAgent?.slice(0, 512) });
    await recordAudit(db, { userId: user.id, entity: "auth", action: "login" });

    const token = await createSession(
      db,
      user.id,
      { idleMinutes: config.sessionIdleMinutes, maxHours: config.sessionMaxHours },
      { ip, userAgent },
      now,
    );
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "Strict",
      path: "/api",
      maxAge: config.sessionMaxHours * 3600,
    });

    return c.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        access: await accessCodes(db, user.id),
      },
    });
  })

  .post("/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) await deleteSession(c.var.db, token);
    deleteCookie(c, SESSION_COOKIE, { path: "/api" });
    return c.json({ message: "Logged out" });
  })

  .get("/me", requireAuth, async (c) => {
    const { db, user } = c.var;
    const [row] = await db.select({ lastLoginAt: users.lastLoginAt }).from(users).where(eq(users.id, user.id));
    return c.json({ ...user, lastLoginAt: row?.lastLoginAt ?? null, access: await accessCodes(db, user.id) });
  })

  .post("/change-pin", requireAuth, async (c) => {
    const { db, user, sessionId } = c.var;
    const { currentPin, newPin } = await readJson(c, changePinSchema);
    const [row] = await db.select({ pinHash: users.pinHash }).from(users).where(eq(users.id, user.id));
    if (!row || !(await verifyPin(currentPin, row.pinHash))) throw badRequest("Current PIN incorrect");
    await db
      .update(users)
      .set({ pinHash: await hashPin(newPin) })
      .where(eq(users.id, user.id));
    await deleteUserSessions(db, user.id, sessionId);
    await recordAudit(db, { userId: user.id, entity: "user", entityId: user.id, action: "change-pin" });
    return c.json({ message: "PIN updated" });
  });
