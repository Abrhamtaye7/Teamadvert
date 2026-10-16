import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { leads, roles } from "@teamadvert/db";
import { createApp } from "../app";
import { FixedWindowLimiter } from "../lib/rateLimit";
import { createHarness, type TestHarness } from "../test/harness";

let h: TestHarness;
let admin: string;
const quote = { name: "Selam Tadesse", phone: "+251 911 223344", email: "", company: "Selam Cafe", service: "Signage", message: "Need a 3m lightbox sign" };

beforeAll(async () => {
  h = await createHarness();
  admin = await h.login();
});
afterAll(async () => {
  await h.close();
});

describe("POST /api/public/quote", () => {
  it("stores the request without login and notifies the office", async () => {
    const res = await h.request("POST", "/api/public/quote", { body: quote });
    expect(res.status).toBe(201);
    const list = await h.request("GET", "/api/leads", { cookie: admin });
    expect(list.json[0]).toMatchObject({ name: "Selam Tadesse", service: "Signage", status: "new", email: null });
    const notes = await h.request("GET", "/api/notifications", { cookie: admin });
    expect(notes.json.some((n: any) => n.message.includes("Selam Tadesse") && n.data.leadId === list.json[0].id)).toBe(true);
  });

  it("validates the form", async () => {
    const res = await h.request("POST", "/api/public/quote", { body: { ...quote, phone: "abc", message: "" } });
    expect(res.status).toBe(400);
    expect(res.json.issues.map((i: any) => i.path[0]).sort()).toEqual(["message", "phone"]);
  });

  it("silently drops honeypot submissions from bots", async () => {
    const before = (await h.db.select().from(leads)).length;
    const res = await h.request("POST", "/api/public/quote", { body: { ...quote, website: "http://spam.example" } });
    expect(res.status).toBe(201);
    expect((await h.db.select().from(leads)).length).toBe(before);
  });

  it("limits requests per IP", async () => {
    const app = createApp({ db: h.db, config: h.config, loginLimiter: h.loginLimiter, quoteLimiter: new FixedWindowLimiter(2, 60_000), cbeVerifier: async () => ({ success: true }) });
    const send = () => app.request("/api/public/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(quote) });
    await send();
    await send();
    expect((await send()).status).toBe(429);
  });
});

describe("/api/leads", () => {
  it("is for Admin and Sales only", async () => {
    expect((await h.request("GET", "/api/leads")).status).toBe(401);
    const roleIds = Object.fromEntries((await h.db.select().from(roles)).map((r) => [r.name, r.id]));
    await h.request("POST", "/api/users", { cookie: admin, body: { username: "prod", pin: "1234", roleId: roleIds.Production } });
    expect((await h.request("GET", "/api/leads", { cookie: await h.login("prod", "1234") })).status).toBe(403);
  });

  it("updates the follow-up status", async () => {
    const [lead] = (await h.request("GET", "/api/leads", { cookie: admin })).json;
    const res = await h.request("PATCH", `/api/leads/${lead.id}`, { cookie: admin, body: { status: "contacted" } });
    expect(res.json.status).toBe("contacted");
    expect((await h.request("GET", "/api/leads?status=new", { cookie: admin })).json.find((l: any) => l.id === lead.id)).toBeUndefined();
    expect((await h.request("PATCH", `/api/leads/${lead.id}`, { cookie: admin, body: { status: "converted", customerId: 9999 } })).status).toBe(404);
  });
});
