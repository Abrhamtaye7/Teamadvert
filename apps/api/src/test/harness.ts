// Shared setup for API integration tests: fresh test database, seeded admin, app instance and request helpers.
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, dropAllTables, loadRootEnv, runMigrations, seedDatabase, type Db } from "@teamadvert/db";
import { createApp } from "../app";
import type { Config } from "../config";
import { DEFAULT_CBE_CONFIG, type CbeVerificationResult, type CbeVerifier } from "../lib/cbe";
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
  // Tests number documents from 1, independent of the business's starting points
  await seedDatabase(db, { adminPin: ADMIN_PIN, counterStarts: [] });

  const config: Config = {
    databaseUrl: url,
    env: "test",
    port: 0,
    sessionIdleMinutes: 120,
    sessionMaxHours: 12,
    cookieSecure: false,
    backupDir: await mkdtemp(path.join(tmpdir(), "teamadvert-backup-")),
    cbe: DEFAULT_CBE_CONFIG,
    publicUrl: "https://teamadvertplc.com",
    ...overrides,
  };
  const loginLimiter = new FixedWindowLimiter(1000, 60_000);
  // Tests set `cbe.next` to control what the (fake) bank returns
  const cbe: { next: CbeVerificationResult; calls: { trx: string; amount: number }[] } = {
    next: { success: true },
    calls: [],
  };
  const cbeVerifier: CbeVerifier = async (trx, amount) => {
    cbe.calls.push({ trx, amount });
    return cbe.next;
  };
  const quoteLimiter = new FixedWindowLimiter(1000, 60_000);
  const verifyLimiter = new FixedWindowLimiter(1000, 60_000);
  const app = createApp({ db, config, loginLimiter, quoteLimiter, verifyLimiter, cbeVerifier });

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

  return { app, db: db as Db, config, loginLimiter, quoteLimiter, verifyLimiter, cbe, request, login, close: () => pool.end() };
}
