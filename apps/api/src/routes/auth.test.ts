import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auditLogs, loginLogs, sessions, users } from "@teamadvert/db";
import { createApp } from "../app";
import { FixedWindowLimiter } from "../lib/rateLimit";
import { createSession, validateSession } from "../lib/sessions";
import { ADMIN_PIN, createHarness, type TestHarness } from "../test/harness";
import { MAX_FAILED_ATTEMPTS } from "./auth";

let h: TestHarness;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.db.update(users).set({ failedAttempts: 0, lockedUntil: null, isActive: true });
});

describe("api basics", () => {
  it("reports health and returns JSON 404s", async () => {
    expect((await h.request("GET", "/api/health")).json).toEqual({ ok: true });
    const missing = await h.request("GET", "/api/nope");
    expect(missing.status).toBe(404);
    expect(missing.json).toEqual({ message: "Not found" });
    expect(missing.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("POST /api/auth/login", () => {
  it("logs in, sets a secure session cookie and records the login", async () => {
    const res = await h.request("POST", "/api/auth/login", { body: { username: "admin", pin: ADMIN_PIN } });
    expect(res.status).toBe(200);
    expect(res.json.user).toMatchObject({ username: "admin", role: "Admin" });
    expect(res.json.user.access).toHaveLength(10);
    expect(res.json).not.toHaveProperty("accessToken");

    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^ta_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api/);

    expect(await h.db.select().from(loginLogs)).not.toHaveLength(0);
  });

  it("rejects a wrong PIN or unknown user with the same message", async () => {
    const wrong = await h.request("POST", "/api/auth/login", { body: { username: "admin", pin: "0000" } });
    const unknown = await h.request("POST", "/api/auth/login", { body: { username: "ghost", pin: "0000" } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json.message).toBe(unknown.json.message);
  });

  it("treats usernames case-insensitively, like the legacy MySQL app", async () => {
    const res = await h.request("POST", "/api/auth/login", { body: { username: " ADMIN ", pin: ADMIN_PIN } });
    expect(res.status).toBe(200);
    expect(res.json.user.username).toBe("admin");
  });

  it("rejects malformed input", async () => {
    const res = await h.request("POST", "/api/auth/login", { body: { username: "admin", pin: "12" } });
    expect(res.status).toBe(400);
  });

  it("locks the account after repeated wrong PINs, even for the right PIN", async () => {
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await h.request("POST", "/api/auth/login", { body: { username: "admin", pin: "0000" } });
    }
    const res = await h.request("POST", "/api/auth/login", { body: { username: "admin", pin: ADMIN_PIN } });
    expect(res.status).toBe(423);
    expect(res.json.message).toMatch(/locked/i);

    const locks = await h.db.select().from(auditLogs).where(eq(auditLogs.action, "locked"));
    expect(locks.length).toBeGreaterThan(0);
  });

  it("refuses deactivated users", async () => {
    await h.db.update(users).set({ isActive: false }).where(eq(users.username, "admin"));
    const res = await h.request("POST", "/api/auth/login", { body: { username: "admin", pin: ADMIN_PIN } });
    expect(res.status).toBe(401);
  });

  it("rate limits by IP", async () => {
    const app = createApp({ db: h.db, config: h.config, loginLimiter: new FixedWindowLimiter(2, 60_000), cbeVerifier: async () => ({ success: true }) });
    const attempt = () =>
      app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "x", pin: "0000" }),
      });
    await attempt();
    await attempt();
    const res = await attempt();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });
});

describe("session lifecycle", () => {
  it("/me requires a session and returns the user", async () => {
    expect((await h.request("GET", "/api/auth/me")).status).toBe(401);
    const cookie = await h.login();
    const me = await h.request("GET", "/api/auth/me", { cookie });
    expect(me.status).toBe(200);
    expect(me.json).toMatchObject({ username: "admin", role: "Admin" });
    expect(me.json.lastLoginAt).toBeTruthy();
  });

  it("logout ends the session", async () => {
    const cookie = await h.login();
    expect((await h.request("POST", "/api/auth/logout", { cookie })).status).toBe(200);
    expect((await h.request("GET", "/api/auth/me", { cookie })).status).toBe(401);
  });

  it("expires sessions after inactivity and after the absolute limit", async () => {
    const [admin] = await h.db.select({ id: users.id }).from(users).where(eq(users.username, "admin"));
    const policy = { idleMinutes: 30, maxHours: 2 };
    const start = new Date("2026-01-01T08:00:00Z");
    const at = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

    const idle = await createSession(h.db, admin.id, policy, {}, start);
    expect(await validateSession(h.db, idle, policy, at(20))).not.toBeNull();
    expect(await validateSession(h.db, idle, policy, at(45))).not.toBeNull(); // activity at 20 extended it
    expect(await validateSession(h.db, idle, policy, at(80))).toBeNull(); // 35 idle minutes

    const absolute = await createSession(h.db, admin.id, policy, {}, start);
    for (const m of [25, 50, 75, 100]) expect(await validateSession(h.db, absolute, policy, at(m))).not.toBeNull();
    expect(await validateSession(h.db, absolute, policy, at(125))).toBeNull(); // past 2h
  });

  it("stores only a hash of the session token", async () => {
    const cookie = await h.login();
    const token = cookie.split("=")[1];
    const rows = await h.db.select({ id: sessions.id }).from(sessions);
    expect(rows.some((r) => r.id === token)).toBe(false);
  });
});

describe("POST /api/auth/change-pin", () => {
  it("changes the PIN and logs out other sessions", async () => {
    const current = await h.login();
    const other = await h.login();

    const wrong = await h.request("POST", "/api/auth/change-pin", { cookie: current, body: { currentPin: "0000", newPin: "1357" } });
    expect(wrong.status).toBe(400);

    const ok = await h.request("POST", "/api/auth/change-pin", { cookie: current, body: { currentPin: ADMIN_PIN, newPin: "1357" } });
    expect(ok.status).toBe(200);
    expect((await h.request("GET", "/api/auth/me", { cookie: current })).status).toBe(200);
    expect((await h.request("GET", "/api/auth/me", { cookie: other })).status).toBe(401);

    await h.login("admin", "1357");
    await h.request("POST", "/api/auth/change-pin", { cookie: current, body: { currentPin: "1357", newPin: ADMIN_PIN } });
  });
});
