import { and, desc, eq, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import { notifications } from "@teamadvert/db";
import { idParam, notFound } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

/** The caller's own notifications plus broadcasts (userId null). */
const visibleTo = (userId: number) => or(eq(notifications.userId, userId), isNull(notifications.userId));

export const notificationRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const { db, user } = c.var;
    return c.json(await db.select().from(notifications).where(visibleTo(user.id)).orderBy(desc(notifications.createdAt)).limit(50));
  })

  // Note: broadcasts share one read flag (legacy behaviour); per-user read state would need its own table.
  .post("/:id/read", async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const [row] = await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), visibleTo(user.id)))
      .returning();
    if (!row) throw notFound("Notification"); // legacy let anyone mark anyone's notification as read
    return c.json(row);
  });
