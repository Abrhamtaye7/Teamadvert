import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "@teamadvert/db";
import { backups, type Db } from "@teamadvert/db";

const gzipAsync = promisify(gzip);

/** Live session tokens are never written to backups. */
const EXCLUDED = new Set(["sessions"]);

const allTables = () =>
  (Object.values(schema) as unknown[])
    .filter((value): value is PgTable => is(value, PgTable))
    .filter((table) => !EXCLUDED.has(getTableConfig(table).name));

/**
 * Writes a gzipped JSON dump of every table to `dir` and records it in `backups`.
 * Legacy only wrote row counts, so its "backups" couldn't restore anything.
 * The files contain PIN hashes: keep `dir` outside public_html.
 */
export async function runBackup(db: Db, dir: string, now = new Date()) {
  const file = path.resolve(dir, `teamadvert-${now.toISOString().replace(/[:.]/g, "-")}.json.gz`);
  try {
    const tables: Record<string, unknown[]> = {};
    for (const table of allTables()) tables[getTableConfig(table).name] = await db.select().from(table);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, await gzipAsync(JSON.stringify({ generatedAt: now.toISOString(), tables })), { mode: 0o600 });
    const [row] = await db.insert(backups).values({ path: file, status: "ok" }).returning();
    return row;
  } catch (err) {
    console.error("Backup failed", err);
    const [row] = await db.insert(backups).values({ path: file, status: "failed" }).returning();
    return row;
  }
}
