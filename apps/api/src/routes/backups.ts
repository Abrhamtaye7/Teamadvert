import { desc } from "drizzle-orm";
import { Hono } from "hono";
import { backups } from "@teamadvert/db";
import { runBackup } from "../lib/backup";
import { requireAuth, requireRole } from "../middleware/auth";
import { ROLES, type AppEnv } from "../types";

export const backupRoutes = new Hono<AppEnv>()
  .use(requireAuth, requireRole(ROLES.Admin))

  .get("/", async (c) => c.json(await c.var.db.select().from(backups).orderBy(desc(backups.createdAt)).limit(20)))

  .post("/run", async (c) => {
    const row = await runBackup(c.var.db, c.var.config.backupDir);
    return c.json({ message: row.status === "ok" ? "Backup created" : "Backup failed", backup: row }, row.status === "ok" ? 200 : 500);
  });
