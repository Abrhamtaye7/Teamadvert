import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditLogs, roles } from "@teamadvert/db";
import { createHarness, type TestHarness } from "../test/harness";

let h: TestHarness;
let admin: string;
let roleIds: Record<string, number>;

beforeAll(async () => {
  h = await createHarness();
  admin = await h.login();
  roleIds = Object.fromEntries((await h.db.select().from(roles)).map((r) => [r.name, r.id]));
});
afterAll(async () => {
  await h.close();
});

async function createUser(username: string, role = "Sales", accessRoleIds?: number[]) {
  return h.request("POST", "/api/users", { cookie: admin, body: { username, pin: "2468", roleId: roleIds[role], accessRoleIds } });
}

describe("/api/users", () => {
  it("is admin-only", async () => {
    expect((await h.request("GET", "/api/users")).status).toBe(401);
    expect((await createUser("sally")).status).toBe(201);
    const sales = await h.login("sally", "2468");
    expect((await h.request("GET", "/api/users", { cookie: sales })).status).toBe(403);
  });

  it("lists users in the legacy shape without PIN hashes", async () => {
    const res = await h.request("GET", "/api/users", { cookie: admin });
    expect(res.status).toBe(200);
    const adminUser = res.json.find((u: any) => u.username === "admin");
    expect(adminUser.role).toMatchObject({ name: "Admin" });
    expect(adminUser.accessGrants[0].accessRole).toHaveProperty("code");
    expect(JSON.stringify(res.json)).not.toMatch(/pinHash|scrypt/);
  });

  it("lists roles and access roles", async () => {
    expect((await h.request("GET", "/api/users/roles", { cookie: admin })).json).toHaveLength(5);
    expect((await h.request("GET", "/api/users/access-roles", { cookie: admin })).json).toHaveLength(10);
  });

  it("creates users with all access by default, or the given access", async () => {
    const all = await createUser("dawit", "Designer");
    expect(all.status).toBe(201);
    expect(all.json.accessGrants).toHaveLength(10);
    expect(all.json).not.toHaveProperty("pinHash");

    const access = (await h.request("GET", "/api/users/access-roles", { cookie: admin })).json;
    const some = await createUser("prod1", "Production", [access[0].id]);
    expect(some.json.accessGrants).toHaveLength(1);

    const audits = await h.db.select().from(auditLogs).where(eq(auditLogs.entity, "user"));
    expect(audits.some((a) => a.action === "create")).toBe(true);
  });

  it("validates input", async () => {
    expect((await createUser("dawit")).status).toBe(409);
    const badPin = await h.request("POST", "/api/users", { cookie: admin, body: { username: "abc", pin: "12ab", roleId: roleIds.Sales } });
    expect(badPin.status).toBe(400);
    expect(badPin.json.issues).toBeDefined();
    const badRole = await h.request("POST", "/api/users", { cookie: admin, body: { username: "abcd", pin: "1234", roleId: 999 } });
    expect(badRole.json.message).toBe("Unknown role");
    expect((await createUser("ghosty", "Sales", [999])).json.message).toBe("Unknown access role");
  });

  it("changes roles, but an admin can't demote themselves", async () => {
    const users = (await h.request("GET", "/api/users", { cookie: admin })).json;
    const dawit = users.find((u: any) => u.username === "dawit");
    const me = users.find((u: any) => u.username === "admin");

    const res = await h.request("PATCH", `/api/users/${dawit.id}/role`, { cookie: admin, body: { roleId: roleIds.Finance } });
    expect(res.json.role.name).toBe("Finance");

    const self = await h.request("PATCH", `/api/users/${me.id}/role`, { cookie: admin, body: { roleId: roleIds.Sales } });
    expect(self.status).toBe(400);
    expect((await h.request("PATCH", "/api/users/99999/role", { cookie: admin, body: { roleId: roleIds.Sales } })).status).toBe(404);
  });

  it("replaces access grants", async () => {
    const users = (await h.request("GET", "/api/users", { cookie: admin })).json;
    const dawit = users.find((u: any) => u.username === "dawit");
    const access = (await h.request("GET", "/api/users/access-roles", { cookie: admin })).json;
    const res = await h.request("PUT", `/api/users/${dawit.id}/access`, {
      cookie: admin,
      body: { accessRoleIds: [access[1].id, access[2].id, access[2].id] },
    });
    expect(res.status).toBe(200);
    expect(res.json.accessGrants.map((g: any) => g.accessRole.id).sort()).toEqual([access[1].id, access[2].id].sort());
  });

  it("resets a PIN, unlocking the user and ending their sessions", async () => {
    const users = (await h.request("GET", "/api/users", { cookie: admin })).json;
    const sally = users.find((u: any) => u.username === "sally");
    const session = await h.login("sally", "2468");

    expect((await h.request("POST", `/api/users/${sally.id}/reset-pin`, { cookie: admin, body: { pin: "9753" } })).status).toBe(200);
    expect((await h.request("GET", "/api/auth/me", { cookie: session })).status).toBe(401);
    await h.login("sally", "9753");
  });

  it("deactivates users, ending their sessions, but not yourself", async () => {
    const users = (await h.request("GET", "/api/users", { cookie: admin })).json;
    const sally = users.find((u: any) => u.username === "sally");
    const me = users.find((u: any) => u.username === "admin");
    const session = await h.login("sally", "9753");

    const res = await h.request("PATCH", `/api/users/${sally.id}/status`, { cookie: admin, body: { isActive: false } });
    expect(res.json.isActive).toBe(false);
    expect((await h.request("GET", "/api/auth/me", { cookie: session })).status).toBe(401);
    expect((await h.request("POST", "/api/auth/login", { body: { username: "sally", pin: "9753" } })).status).toBe(401);

    expect((await h.request("PATCH", `/api/users/${me.id}/status`, { cookie: admin, body: { isActive: false } })).status).toBe(400);
  });
});
