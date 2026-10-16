import { sql } from "drizzle-orm";
import type { Db } from "./client";

/**
 * Drops every table and type in the connected database's public schema. Test-only: refuses to run
 * unless the database name ends with "_test", so it can never wipe dev or production data.
 */
export async function dropAllTables(db: Db) {
  const [{ name }] = await db.execute<{ name: string }>(sql`SELECT current_database() AS name`);
  if (!name?.endsWith("_test")) throw new Error(`Refusing to drop tables in non-test database "${name}"`);
  await db.execute(sql`DROP SCHEMA public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
}
