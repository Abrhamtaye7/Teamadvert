import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Db } from "./client";

export const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

// Keep the migrations log in `public`: cPanel database users may not be allowed to create schemas.
export const MIGRATIONS_SCHEMA = "public";

export async function runMigrations(db: Db, folder = migrationsFolder) {
  await migrate(db, { migrationsFolder: folder, migrationsSchema: MIGRATIONS_SCHEMA });
}
