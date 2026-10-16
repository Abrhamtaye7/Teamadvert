// End-to-end business flow through the API, as the different roles would do it in the office app.
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { businessYear, roles } from "@teamadvert/db";
import { createHarness, type TestHarness } from "../test/harness";

let h: TestHarness;
const as: Record<string, string> = {};
const yy = String(businessYear()).padStart(2, "0");

beforeAll(async () => {
  h = await createHarness();
  as.admin = await h.login();
  const roleIds = Object.fromEntries((await h.db.select().from(roles)).map((r) => [r.name, r.id]));
  for (const [username, role] of [["sara", "Sales"], ["dani", "Designer"], ["pete", "Production"], ["fana", "Finance"]] as const) {
    const res = await h.request("POST", "/api/users", { cookie: as.admin, body: { username, pin: "1111", roleId: roleIds[role] } });
    expect(res.status).toBe(201);
    as[role] = await h.login(username, "1111");
  }
});
afterAll(async () => {
  await h.close();
});

const get = (path: string, who = "admin") => h.request("GET", path, { cookie: as[who] });
const post = (path: string, body: unknown, who = "admin") => h.request("POST", path, { cookie: as[who], body });
const put = (path: string, body: unknown, who = "admin") => h.request("PUT", path, { cookie: as[who], body });

const ids: Record<string, number> = {};

describe("customers", () => {
  it("creates customers with a server-assigned code, phones and address", async () => {
    const res = await post(
      "/api/customers",
      { customerId: "TEMP", name: "Abebe Kebede", company: "Sunrise Trading", phone: "0911000000, 0922000000", addressCity: "Addis Ababa", addressWoreda: " " },
      "Sales",
    );
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ customerId: "CID0001", phones: ["0911000000", "0922000000"], address: { city: "Addis Ababa" } });
    ids.customer = res.json.id;
  });

  it("only lets Admin and Sales create customers", async () => {
    expect((await post("/api/customers", { name: "X" }, "Production")).status).toBe(403);
  });

  it("lists and searches case-insensitively, with counts", async () => {
    const res = await get("/api/customers?q=sunrise&pageSize=5", "Production");
    expect(res.json).toMatchObject({ total: 1, page: 1, pageSize: 5 });
    expect(res.json.data[0]._count).toEqual({ proformas: 0, jobs: 0 });
    expect((await get("/api/customers?phone=0922")).json.total).toBe(1);
  });

  it("updates only the given fields and keeps notes", async () => {
    const res = await put(`/api/customers/${ids.customer}`, { tin: "0012345678" }, "Sales");
    expect(res.json).toMatchObject({ tin: "0012345678", company: "Sunrise Trading", phones: ["0911000000", "0922000000"] });
    expect((await post(`/api/customers/${ids.customer}/notes`, { note: "  " })).status).toBe(400);
    expect((await post(`/api/customers/${ids.customer}/notes`, { note: "Prefers pickup" })).status).toBe(201);
    const detail = await get(`/api/customers/${ids.customer}`);
    expect(detail.json.notes[0]).toMatchObject({ note: "Prefers pickup", user: { username: "admin" } });
    expect((await get("/api/customers/9999")).status).toBe(404);
  });
});

describe("items and suppliers", () => {
  it("manages categories, units and items", async () => {
    const cat = await post("/api/items/categories", { name: "Banners" }, "Finance");
    const unit = await post("/api/items/units", { unitName: "m²" }, "Finance");
    expect((await post("/api/items/units", { unitName: "m²" })).status).toBe(409);
    const item = await post("/api/items", { name: "Flex Banner", categoryId: cat.json.id, measurementUnitId: unit.json.id, sellingPrice: 450, purchasePrice: 300 }, "Sales");
    expect(item.status).toBe(201);
    expect(item.json).toMatchObject({ itemId: "ITEM0001", basePrice: 450 });
    ids.item = item.json.id;

    const list = await get("/api/items?q=flex");
    expect(list.json.data[0]).toMatchObject({ category: { name: "Banners" }, measurementUnit: { unitName: "m²" } });
    expect((await post("/api/items", { name: "Bad", categoryId: 999 })).status).toBe(400);
  });

  it("records supplier prices, matching items by name and tracking the old price", async () => {
    const supplier = await post("/api/suppliers", { supplierId: "TEMP", companyName: "Print Supply PLC", phone: "0115000000" }, "Finance");
    expect(supplier.json.supplierId).toBe("SID0001");
    ids.supplier = supplier.json.id;

    await post(`/api/suppliers/${ids.supplier}/items`, { items: [{ name: "flex banner", price: 280 }, { name: "Vinyl Sticker", price: 90 }] });
    const detail = (await post(`/api/suppliers/${ids.supplier}/items`, [{ itemId: ids.item, name: "Flex Banner", price: 300 }])).json;
    expect(detail.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: ids.item, price: 300 }),
        expect.objectContaining({ name: "Vinyl Sticker", price: 90 }),
      ]),
    );
    expect(detail.priceHistory[0]).toMatchObject({ itemId: ids.item, oldPrice: 280, newPrice: 300, user: { username: "admin" } });

    const profile = await get(`/api/items/${ids.item}/profile`);
    expect(profile.json.supplierPriceHistory).toHaveLength(2);
    expect(JSON.stringify(profile.json)).not.toMatch(/pinHash/);
  });
});

describe("proformas", () => {
  it("creates a proforma for a new customer with VAT, totals and amount in words", async () => {
    const res = await post(
      "/api/proformas",
      {
        customerNew: { name: "Hana Bekele", phones: ["0933000000"] },
        validity: 15,
        items: [
          { itemId: ids.item, name: "Flex Banner", quantity: 10, sellingPrice: 100 },
          { name: "Design fee", quantity: 1, sellingPrice: 500, vatPercent: 0 },
        ],
      },
      "Designer",
    );
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ number: `TAPI-001-${yy}`, status: "draft", preparedBy: { username: "dani" } });
    expect(res.json.customer.customerId).toBe("CID0002");
    expect(res.json.items.map((i: any) => i.total)).toEqual([1150, 500]);
    expect(res.json.amountInWords).toBe("one thousand six hundred fifty birr");
    ids.proforma = res.json.id;
  });

  it("prints totals that respect VAT-exempt lines", async () => {
    const res = await get(`/api/proformas/${ids.proforma}/print`);
    expect(res.json.totals).toEqual({ subtotal: 1500, discount: 0, vat: 150, total: 1650, amountInWords: "one thousand six hundred fifty birr" });
  });

  it("lets drafts be edited, then only Admin approves, once", async () => {
    const edited = await put(`/api/proformas/${ids.proforma}`, { notes: "Delivery included" }, "Sales");
    expect(edited.json.notes).toBe("Delivery included");
    expect((await post(`/api/proformas/${ids.proforma}/approve`, {}, "Sales")).status).toBe(403);
    expect((await post(`/api/proformas/${ids.proforma}/approve`, {})).json.status).toBe("approved");
    expect((await post(`/api/proformas/${ids.proforma}/approve`, {})).status).toBe(400);
    expect((await put(`/api/proformas/${ids.proforma}`, { notes: "late edit" })).status).toBe(400);
  });

  it("filters by status, item, grand total and date", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa" }).format(new Date());
    expect((await get(`/api/proformas?status=approved&itemName=banner&amountMin=1600&endDate=${today}&q=`)).json.total).toBe(1);
    expect((await get("/api/proformas?amountMin=2000")).json.total).toBe(0);
    expect((await get("/api/proformas?q=hana")).json.total).toBe(1);
  });

  it("converts to exactly one job whose lines add up to the proforma total", async () => {
    const job = await post(`/api/proformas/${ids.proforma}/convert`, {}, "Designer");
    expect(job.status).toBe(201);
    expect(job.json).toMatchObject({ number: `TAJO-001-${yy}`, price: 1650, status: "pending_approval" });
    ids.convertedJob = job.json.id;
    expect((await post(`/api/proformas/${ids.proforma}/convert`, {}, "Designer")).status).toBe(400);

    const full = await get(`/api/jobs/${job.json.id}`);
    for (const line of full.json.jobItems) expect(Math.round(line.quantity * line.price)).toBe(Math.round(line.total));
    expect(full.json.proforma.status).toBe("converted");
  });
});

describe("jobs", () => {
  it("rejects a second job for the same proforma", async () => {
    const res = await post("/api/jobs", { customerId: ids.customer, proformaNumber: `TAPI-001-${yy}`, jobItems: [] }, "Designer");
    expect(res.status).toBe(409);
  });

  it("creates a manual job priced from its lines", async () => {
    const res = await post(
      "/api/jobs",
      { customerId: ids.customer, jobType: "Banner", priority: "high", deadline: "2026-12-01", jobItems: [{ name: "Banner 3x1m", quantity: 2, price: 500 }] },
      "Sales",
    );
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ number: `TAJO-002-${yy}`, price: 1000, createdBy: { username: "sara" } });
    expect(res.json.customerSnapshot.name).toBe("Abebe Kebede");
    ids.job = res.json.id;
  });

  it("enforces the workflow order", async () => {
    const early = await post(`/api/jobs/${ids.job}/production`, { status: "completed" }, "Production");
    expect(early.status).toBe(400);
    expect(early.json.message).toMatch(/pending approval/);
    expect((await post(`/api/jobs/${ids.job}/approve`, {}, "Production")).status).toBe(403);

    const approved = await post(`/api/jobs/${ids.job}/approve`, { adminNotes: "Rush" });
    expect(approved.json).toMatchObject({ status: "approved", adminNotes: "Rush" });
    expect((await post(`/api/jobs/${ids.job}/production`, { status: "in_progress" }, "Production")).json.status).toBe("in_progress");
    expect((await post(`/api/jobs/${ids.job}/finance`, { status: "closed" }, "Finance")).status).toBe(400);
    expect((await post(`/api/jobs/${ids.job}/production`, { status: "Completed" }, "Production")).json.status).toBe("completed");
  });

  it("filters jobs like the office Reports page", async () => {
    const res = await get("/api/jobs?pageSize=100&createdBy=SARA&itemName=banner&status=completed");
    expect(res.json.total).toBe(1);
    expect((await get("/api/jobs?status=bogus")).status).toBe(400);
  });
});

describe("payments", () => {
  it("closes a completed job once it is fully paid in cash", async () => {
    const part = await post("/api/payments", { jobId: ids.job, amount: 400, method: "Cash" }, "Finance");
    expect(part.status).toBe(201);
    expect(part.json.customerId).toBe(ids.customer);
    expect((await get(`/api/jobs/${ids.job}`)).json.status).toBe("completed");

    await post("/api/payments", { jobId: ids.job, amount: 600, method: "Cash" }, "Finance");
    expect((await get(`/api/jobs/${ids.job}`)).json.status).toBe("closed");
    expect((await post("/api/payments", { jobId: ids.job, amount: 1, method: "Cash" }, "Finance")).status).toBe(400);
  });

  it("requires a transaction number for bank transfers", async () => {
    expect((await post("/api/payments", { jobId: ids.convertedJob, amount: 10, method: "Bank" }, "Finance")).status).toBe(400);
  });

  it("sends a fully paid bank transfer to finance review and verifies it with CBE", async () => {
    const jobId = ids.convertedJob;
    await post(`/api/jobs/${jobId}/approve`, {});
    await post(`/api/jobs/${jobId}/production`, { status: "completed" }, "Production");
    const pay = await post("/api/payments", { jobId, amount: 1650, method: "Bank", transactionNumber: " FT26289ABCD " }, "Finance");
    expect(pay.json.transactionNumber).toBe("FT26289ABCD");
    expect((await get(`/api/jobs/${jobId}`)).json.status).toBe("finance_review");

    h.cbe.next = { success: false, issues: ["Amount mismatch"] };
    const bad = await post(`/api/payments/${pay.json.id}/verify`, { transactionNumber: "FT26289ABCD", expectedAmount: 1650 }, "Finance");
    expect(bad.json.success).toBe(false);

    h.cbe.next = { success: true };
    const good = await post(`/api/payments/${pay.json.id}/verify`, { transactionNumber: "FT26289ABCD", expectedAmount: 1650 }, "Finance");
    expect(good.json.success).toBe(true);
    expect(h.cbe.calls.at(-1)).toEqual({ trx: "FT26289ABCD", amount: 1650 });

    const list = await get("/api/payments", "Finance");
    expect(list.json.find((p: any) => p.id === pay.json.id)).toMatchObject({ verified: true, verificationNote: null, jobOrder: { number: `TAJO-001-${yy}` } });

    expect((await post(`/api/jobs/${jobId}/finance`, { status: "closed" }, "Finance")).json.status).toBe("closed");
  });
});

describe("reports, notifications, search", () => {
  it("summarises this month", async () => {
    const res = await get("/api/reports/overview?months=3");
    expect(res.json.chart).toHaveLength(3);
    expect(res.json.summary).toMatchObject({ jobsThisMonth: 2, pendingJobs: 0, collectedThisMonth: 2650, financeApprovedTotal: 2650 });
  });

  it("raises notifications for approvals, completion and payments", async () => {
    const res = await get("/api/notifications", "Production");
    const types = res.json.map((n: any) => n.type);
    expect(types).toEqual(expect.arrayContaining(["ProformaApproved", "JobApproved", "JobCompleted", "PaymentPending", "PaymentVerified"]));
    expect((await post(`/api/notifications/${res.json[0].id}/read`, {}, "Production")).json.read).toBe(true);
    expect((await post("/api/notifications/99999/read", {}, "Production")).status).toBe(404);
  });

  it("searches across records", async () => {
    const res = await get("/api/search?q=banner");
    expect(res.json.items.length).toBeGreaterThan(0);
    expect(Object.keys((await get("/api/search?q=TAJO&scope=jobs")).json)).toEqual(["jobs"]);
  });
});

describe("backups", () => {
  it("lets only Admin dump every table except sessions", async () => {
    expect((await post("/api/backups/run", {}, "Finance")).status).toBe(403);
    const res = await post("/api/backups/run", {});
    expect(res.status).toBe(200);
    const dump = JSON.parse(gunzipSync(await readFile(res.json.backup.path)).toString());
    expect(dump.tables.customers).toHaveLength(2);
    expect(dump.tables).not.toHaveProperty("sessions");
    expect((await get("/api/backups")).json[0].status).toBe("ok");
  });
});
