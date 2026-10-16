import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { ApiError } from "../lib/errors";
import { SESSION_COOKIE, validateSession } from "../lib/sessions";
import type { AppEnv } from "../types";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) throw new ApiError(401, "Not logged in");
  const { config } = c.var;
  const session = await validateSession(c.var.db, token, {
    idleMinutes: config.sessionIdleMinutes,
    maxHours: config.sessionMaxHours,
  });
  if (!session) throw new ApiError(401, "Session expired");
  c.set("user", session.user);
  c.set("sessionId", session.sessionId);
  await next();
});

/** Must run after requireAuth. */
export const requireRole = (...allowed: string[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!allowed.includes(c.var.user.role)) throw new ApiError(403, "Forbidden");
    await next();
  });
