import { or } from "drizzle-orm";
import { Hono } from "hono";
import { customers, items, jobOrders, payments, proformas, suppliers } from "@teamadvert/db";
import { contains } from "../lib/query";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const LIMIT = 10;
const SCOPES = ["customers", "suppliers", "items", "proformas", "jobs", "payments"] as const;

export const searchRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const { db } = c.var;
    const q = (c.req.query("q") ?? "").trim();
    const scope = c.req.query("scope") ?? "all";
    const wants = (s: (typeof SCOPES)[number]) => scope === "all" || scope === s;

    const [customerRows, supplierRows, itemRows, proformaRows, jobRows, paymentRows] = await Promise.all([
      wants("customers") ? db.select().from(customers).where(or(contains(customers.name, q), contains(customers.company, q))).limit(LIMIT) : undefined,
      wants("suppliers") ? db.select().from(suppliers).where(contains(suppliers.companyName, q)).limit(LIMIT) : undefined,
      wants("items") ? db.select().from(items).where(contains(items.name, q)).limit(LIMIT) : undefined,
      wants("proformas") ? db.select().from(proformas).where(contains(proformas.number, q)).limit(LIMIT) : undefined,
      wants("jobs") ? db.select().from(jobOrders).where(contains(jobOrders.number, q)).limit(LIMIT) : undefined,
      wants("payments") ? db.select().from(payments).where(contains(payments.transactionNumber, q)).limit(LIMIT) : undefined,
    ]);
    const results: Record<string, unknown> = {};
    if (customerRows) results.customers = customerRows;
    if (supplierRows) results.suppliers = supplierRows;
    if (itemRows) results.items = itemRows;
    if (proformaRows) results.proformas = proformaRows;
    if (jobRows) results.jobs = jobRows;
    if (paymentRows) results.payments = paymentRows;
    return c.json(results);
  });
