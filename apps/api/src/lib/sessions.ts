import { createHash, randomBytes } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { roles, sessions, users, type Db, type Permissions } from "@teamadvert/db";

export const SESSION_COOKIE = "ta_session";

export type AuthUser = {
  id: number;
  username: string;
  role: string;
  permissions: Permissions;
};

type SessionPolicy = { idleMinutes: number; maxHours: number };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(
  db: Db,
  userId: number,
  policy: SessionPolicy,
  meta: { ip?: string; userAgent?: string } = {},
  now = new Date(),
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(now.getTime() + policy.maxHours * 3_600_000),
    lastSeenAt: now,
    ip: meta.ip?.slice(0, 64),
    userAgent: meta.userAgent?.slice(0, 512),
  });
  return token;
}

/**
 * Returns the session's user, or null if the token is unknown, expired, idle too long, or the user
 * is deactivated (in which case the session is deleted). Refreshes lastSeenAt at most once a minute.
 */
export async function validateSession(
  db: Db,
  token: string,
  policy: SessionPolicy,
  now = new Date(),
): Promise<{ user: AuthUser; sessionId: string } | null> {
  const id = hashToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      id: users.id,
      username: users.username,
      isActive: users.isActive,
      role: roles.name,
      permissions: roles.permissions,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(sessions.id, id));
  if (!row) return null;

  const idleLimit = row.lastSeenAt.getTime() + policy.idleMinutes * 60_000;
  if (row.expiresAt <= now || idleLimit <= now.getTime() || !row.isActive) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (now.getTime() - row.lastSeenAt.getTime() > 60_000) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, id));
  }
  return {
    sessionId: id,
    user: { id: row.id, username: row.username, role: row.role, permissions: row.permissions ?? {} },
  };
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/** Logs the user out everywhere, optionally keeping one session (e.g. the one that changed the PIN). */
export async function deleteUserSessions(db: Db, userId: number, keepSessionId?: string) {
  await db
    .delete(sessions)
    .where(keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)) : eq(sessions.userId, userId));
}
