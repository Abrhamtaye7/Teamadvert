// Shared setup for API integration tests: fresh test database, seeded admin, app instance and request helpers.
import { createDb, dropAllTables, loadRootEnv, runMigrations, seedDatabase, type Db } from "@teamadvert/db";
import { createApp } from "../app";
import type { Config } from "../config";
import { FixedWindowLimiter } from "../lib/rateLimit";

export const ADMIN_PIN = "4821";

export type TestHarness = Awaited<ReturnType<typeof createHarness>>;

export async function createHarness(overrides: Partial<Config> = {}) {
  loadRootEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (copy .env.example to .env and run `npm run db:up`)");

  const { db, pool } = createDb(url, { connectionLimit: 5 });
  await dropAllTables(db);
  await runMigrations(db);
  await seedDatabase(db, { adminPin: ADMIN_PIN });

  const config: Config = {
    databaseUrl: url,
    env: "test",
    port: 0,
    sessionIdleMinutes: 120,
    sessionMaxHours: 12,
    cookieSecure: false,
    ...overrides,
  };
  const loginLimiter = new FixedWindowLimiter(1000, 60_000);
  const app = createApp({ db, config, loginLimiter });

  async function request(method: string, path: string, { body, cookie }: { body?: unknown; cookie?: string } = {}) {
    const res = await app.request(path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: res.status, json, headers: res.headers };
  }

  /** Logs in and returns the Cookie header value for later requests. */
  async function login(username = "admin", pin = ADMIN_PIN) {
    const res = await request("POST", "/api/auth/login", { body: { username, pin } });
    if (res.status !== 200) throw new Error(`login ${username} failed: ${res.status} ${JSON.stringify(res.json)}`);
    const setCookie = res.headers.get("set-cookie") ?? "";
    return setCookie.split(";")[0];
  }

  return { app, db: db as Db, config, loginLimiter, request, login, close: () => pool.end() };
}
