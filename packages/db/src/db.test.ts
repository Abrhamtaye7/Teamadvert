// Integration tests against a real PostgreSQL (start it with `npm run db:up`).
import { count, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client";
import {
  applyCounterStarts,
  businessYear,
  COUNTER_STARTS,
  formatCode,
  formatYearlyNumber,
  nextCustomerCode,
  nextJobNumber,
  nextProformaNumber,
  nextSequence,
} from "./counters";
import { loadRootEnv } from "./env";
import { runMigrations } from "./migrations";
import { verifyPin } from "./pin";
import { accessRoles, roles, userAccessRoles, users } from "./schema";
import { seedDatabase } from "./seeding";
import { dropAllTables } from "./testing";

loadRootEnv();
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set (copy .env.example to .env and start `docker compose up -d`)");

let db: Db;
let pool: ReturnType<typeof createDb>["pool"];

beforeAll(async () => {
  ({ db, pool } = createDb(url, { connectionLimit: 10 }));
  await dropAllTables(db);
  await runMigrations(db);
});

afterAll(async () => {
  await pool?.end();
});

describe("migrations", () => {
  it("create every table", async () => {
    const [row] = await db.execute<{ n: number }>(
      sql`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> '__drizzle_migrations'`,
    );
    expect(row.n).toBe(27);
  });

  it("keep the migrations log in the public schema", async () => {
    const [row] = await db.execute<{ n: number }>(
      sql`SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'`,
    );
    expect(row.n).toBe(1);
  });

  it("refuse to drop tables outside a _test database", async () => {
    const dev = createDb(url!.replace(/_test$/, ""), { connectionLimit: 1 });
    try {
      await expect(dropAllTables(dev.db)).rejects.toThrow(/non-test database/);
    } finally {
      await dev.pool.end();
    }
  });
});

describe("counters", () => {
  it("counts up from 1 per scope and period", async () => {
    expect(await nextSequence(db, "T1", 26)).toBe(1);
    expect(await nextSequence(db, "T1", 26)).toBe(2);
    expect(await nextSequence(db, "T1", 27)).toBe(1);
    expect(await nextSequence(db, "T2", 26)).toBe(1);
  });

  it("never hands out the same number to concurrent requests", async () => {
    const values = await Promise.all(Array.from({ length: 25 }, () => nextSequence(db, "RACE", 0)));
    expect(new Set(values).size).toBe(25);
    expect(Math.max(...values)).toBe(25);
  });

  it("works inside a transaction", async () => {
    const value = await db.transaction((tx) => nextSequence(tx, "TX", 0));
    expect(value).toBe(1);
  });

  it("formats document numbers: 4-digit proformas, 3-digit jobs", async () => {
    const date = new Date("2026-03-01T10:00:00Z");
    expect(await nextProformaNumber(db, date)).toBe("TAPI-0001-26");
    expect(await nextProformaNumber(db, date)).toBe("TAPI-0002-26");
    expect(await nextJobNumber(db, date)).toBe("TAJO-001-26");
    expect(await nextProformaNumber(db, new Date("2027-01-02T10:00:00Z"))).toBe("TAPI-0001-27");
    expect(await nextCustomerCode(db)).toBe("CID0001");
    expect(formatYearlyNumber("TAPI", 1234, 26)).toBe("TAPI-1234-26");
    expect(formatCode("ITEM", 12)).toBe("ITEM0012");
  });

  it("continues from the previous system's numbers: TAPI-0520-26 and CID0520 come next", async () => {
    const date = new Date("2026-06-01T10:00:00Z");
    await applyCounterStarts(db);
    expect(await nextProformaNumber(db, date)).toBe("TAPI-0520-26");
    expect(await nextCustomerCode(db)).toBe("CID0520");
    // Safe to repeat: a counter never moves backwards
    await applyCounterStarts(db);
    expect(await nextProformaNumber(db, date)).toBe("TAPI-0521-26");
    expect(await nextCustomerCode(db)).toBe("CID0521");
    // Other years and sequences are not affected
    expect(await nextProformaNumber(db, new Date("2027-01-02T10:00:00Z"))).toBe("TAPI-0002-27");
    expect(COUNTER_STARTS.map((s) => s.scope)).toEqual(["TAPI", "CID"]);
  });

  it("uses the Addis Ababa calendar year", () => {
    // 22:30 UTC on Dec 31 is already Jan 1 in Addis Ababa (UTC+3)
    expect(businessYear(new Date("2026-12-31T22:30:00Z"))).toBe(27);
    expect(businessYear(new Date("2026-12-31T20:30:00Z"))).toBe(26);
  });
});

describe("seedDatabase", () => {
  it("refuses to create the first admin without a valid PIN", async () => {
    await expect(seedDatabase(db)).rejects.toThrow(/SEED_ADMIN_PIN/);
    await expect(seedDatabase(db, { adminPin: "12" })).rejects.toThrow(/SEED_ADMIN_PIN/);
  });

  it("creates roles, access roles and an admin with every access role, idempotently", async () => {
    expect(await seedDatabase(db, { adminPin: "4821" })).toEqual({ adminCreated: true });
    expect(await seedDatabase(db, { adminPin: "9999" })).toEqual({ adminCreated: false });

    const [{ n: roleCount }] = await db.select({ n: count() }).from(roles);
    const [{ n: accessCount }] = await db.select({ n: count() }).from(accessRoles);
    expect(roleCount).toBe(5);
    expect(accessCount).toBe(10);

    const [admin] = await db
      .select({ id: users.id, pinHash: users.pinHash, role: roles.name, permissions: roles.permissions })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(eq(users.username, "admin"));
    expect(admin.role).toBe("Admin");
    expect(await verifyPin("4821", admin.pinHash)).toBe(true);
    // JSONB must come back as an object, not a string
    expect(admin.permissions).toEqual({ manageUsers: true, managePrices: true, approveJobs: true });

    const [{ n: grantCount }] = await db
      .select({ n: count() })
      .from(userAccessRoles)
      .where(eq(userAccessRoles.userId, admin.id));
    expect(grantCount).toBe(10);
  });
});
