// Database setup on cPanel without tsx/npm (built to dist/db-cli.mjs):
//   node dist/db-cli.mjs migrate   # apply migrations from ../migrations (or MIGRATIONS_DIR)
//   node dist/db-cli.mjs seed      # roles, access roles, first admin from SEED_ADMIN_PIN
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, loadRootEnv, requireEnv, runMigrations, seedDatabase } from "@teamadvert/db";

loadRootEnv();
const command = process.argv[2];
const migrationsDir =
  process.env.MIGRATIONS_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

if (command !== "migrate" && command !== "seed") {
  console.error("Usage: node dist/db-cli.mjs <migrate|seed>");
  process.exit(2);
}

const { db, pool } = createDb(requireEnv("DATABASE_URL"), { connectionLimit: 1 });
try {
  if (command === "migrate") {
    await runMigrations(db, path.resolve(migrationsDir));
    console.log(`Migrations applied from ${migrationsDir}`);
  } else {
    const { adminCreated } = await seedDatabase(db, { adminPin: process.env.SEED_ADMIN_PIN });
    console.log(adminCreated ? "Seeded; created user 'admin' with SEED_ADMIN_PIN." : "Seeded roles and access roles (users already exist).");
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
