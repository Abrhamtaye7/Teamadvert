import { createDb } from "../src/client";
import { loadRootEnv, requireEnv } from "../src/env";
import { runMigrations } from "../src/migrations";

loadRootEnv();
const { db, pool } = createDb(requireEnv("DATABASE_URL"));
try {
  await runMigrations(db);
  console.log("Migrations applied.");
} finally {
  await pool.end();
}
