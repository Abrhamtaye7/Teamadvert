import { createDb } from "../src/client";
import { loadRootEnv, requireEnv } from "../src/env";
import { seedDatabase } from "../src/seeding";

loadRootEnv();
const { db, pool } = createDb(requireEnv("DATABASE_URL"));
try {
  const { adminCreated } = await seedDatabase(db, { adminPin: process.env.SEED_ADMIN_PIN });
  console.log(
    adminCreated
      ? "Seeded roles and access roles; created user 'admin' with SEED_ADMIN_PIN. Change the PIN after first login."
      : "Seeded roles and access roles (users already exist, no admin created).",
  );
} finally {
  await pool.end();
}
