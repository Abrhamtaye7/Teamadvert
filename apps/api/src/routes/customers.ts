import { and, count, desc, eq, inArray, or, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { customerNoteSchema, customerSchema, customerUpdateSchema } from "@teamadvert/shared/schemas";
import {
  creditHistory,
  creditStandings,
  customerNotes,
  customerPriceHistory,
  customers,
  items,
  jobItems,
  jobOrders,
  nextCustomerCode,
  payments,
  proformaItems,
  proformas,
  type Db,
} from "@teamadvert/db";
import { recordAudit } from "../lib/audit";
import { buildAddress, toPhoneArray } from "../lib/customers";
import { idParam, notFound, readJson } from "../lib/errors";
import { contains, groupBy, indexBy, jsonContains, pagination } from "../lib/query";
import { loadPublicUsers } from "../lib/users";
import { requireAuth, requireRole } from "../middleware/auth";
import { ROLES, type AppEnv } from "../types";

type CustomerInput = ReturnType<typeof customerUpdateSchema.parse>;

/** Maps the legacy flat form (phone, addressRegion, …) onto columns. Undefined fields are left unchanged on update. */
function toColumns(input: CustomerInput) {
  const { customerId: _ignored, phone, addressRegion, addressCity, addressSubcity, addressWoreda, addressHouse, ...rest } =
    input;
  const hasAddress = [addressRegion, addressCity, addressSubcity, addressWoreda, addressHouse].some((v) => v !== undefined);
  return {
    ...rest,
    ...(phone !== undefined ? { phones: toPhoneArray(phone) ?? null } : {}),
    ...(hasAddress
      ? { address: buildAddress({ addressRegion, addressCity, addressSubcity, addressWoreda, addressHouse }) ?? null }
      : {}),
  };
}

async function loadCustomer(db: Db, id: number) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  if (!customer) throw notFound("Customer");
  return customer;
}

/** Customer with related records, in the legacy (Prisma include) shape. `limited` = the detail view, else the full profile. */
async function customerDetail(db: Db, id: number, limited: boolean) {
  const customer = await loadCustomer(db, id);
  const lim = <T>(rows: T[], n: number) => (limited ? rows.slice(0, n) : rows);

  const [notes, proformaRows, jobRows, paymentRows, credit, prices] = await Promise.all([
    db.select().from(customerNotes).where(eq(customerNotes.customerId, id)).orderBy(desc(customerNotes.createdAt)),
    db.select().from(proformas).where(eq(proformas.customerId, id)).orderBy(desc(proformas.createdAt)),
    db.select().from(jobOrders).where(eq(jobOrders.customerId, id)).orderBy(desc(jobOrders.createdAt)),
    db.select().from(payments).where(eq(payments.customerId, id)).orderBy(desc(payments.createdAt)).limit(5),
    db.select().from(creditHistory).where(eq(creditHistory.customerId, id)).orderBy(desc(creditHistory.createdAt)).limit(5),
    db
      .select({ history: customerPriceHistory, item: items })
      .from(customerPriceHistory)
      .innerJoin(items, eq(items.id, customerPriceHistory.itemId))
      .where(eq(customerPriceHistory.customerId, id))
      .orderBy(desc(customerPriceHistory.createdAt)),
  ]);

  const shownProformas = lim(proformaRows, 20);
  const shownJobs = lim(jobRows, 20);
  const [pItems, jItems] = await Promise.all([
    shownProformas.length
      ? db.select().from(proformaItems).where(inArray(proformaItems.proformaId, shownProformas.map((p) => p.id)))
      : [],
    shownJobs.length ? db.select().from(jobItems).where(inArray(jobItems.jobId, shownJobs.map((j) => j.id))) : [],
  ]);
  const pItemsBy = groupBy(pItems, (i) => i.proformaId);
  const jItemsBy = groupBy(jItems, (i) => i.jobId);
  const shownPrices = lim(prices, 20);
  const shownNotes = lim(notes, 10);
  const people = await loadPublicUsers(db, [...shownPrices.map((p) => p.history.changedBy), ...shownNotes.map((n) => n.userId)]);

  return {
    ...customer,
    notes: shownNotes.map((n) => ({ ...n, user: n.userId ? (people.get(n.userId) ?? null) : null })),
    proformas: shownProformas.map((p) => ({ ...p, items: pItemsBy.get(p.id) ?? [] })),
    jobs: shownJobs.map((j) => ({ ...j, jobItems: jItemsBy.get(j.id) ?? [] })),
    payments: paymentRows,
    creditHistory: credit,
    priceHistory: shownPrices.map(({ history, item }) => ({
      ...history,
      item,
      user: history.changedBy ? (people.get(history.changedBy) ?? null) : null,
    })),
  };
}

export const customerRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const { db } = c.var;
    const { q, standing, page, pageSize, phone, tin, email } = c.req.query();
    const paging = pagination(page, pageSize);

    const conditions: (SQL | undefined)[] = [];
    if (standing && (creditStandings as readonly string[]).includes(standing)) {
      conditions.push(eq(customers.standing, standing as (typeof creditStandings)[number]));
    }
    if (q) {
      conditions.push(
        or(contains(customers.name, q), contains(customers.company, q), contains(customers.customerId, q), contains(customers.tin, q)),
      );
    }
    if (phone) conditions.push(jsonContains(customers.phones, phone));
    if (tin) conditions.push(contains(customers.tin, tin));
    if (email) conditions.push(contains(customers.email, email));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(customers).where(where).orderBy(desc(customers.createdAt)).limit(paging.pageSize).offset(paging.offset),
      db.select({ total: count() }).from(customers).where(where),
    ]);
    const ids = rows.map((r) => r.id);
    const [credit, proformaCounts, jobCounts] = ids.length
      ? await Promise.all([
          db.select().from(creditHistory).where(inArray(creditHistory.customerId, ids)).orderBy(desc(creditHistory.createdAt)),
          db.select({ id: proformas.customerId, n: count() }).from(proformas).where(inArray(proformas.customerId, ids)).groupBy(proformas.customerId),
          db.select({ id: jobOrders.customerId, n: count() }).from(jobOrders).where(inArray(jobOrders.customerId, ids)).groupBy(jobOrders.customerId),
        ])
      : [[], [], []];
    const creditBy = groupBy(credit, (h) => h.customerId);
    const pCount = indexBy(proformaCounts, (r) => r.id);
    const jCount = indexBy(jobCounts, (r) => r.id);

    const data = rows.map((customer) => ({
      ...customer,
      creditHistory: (creditBy.get(customer.id) ?? []).slice(0, 5),
      _count: { proformas: pCount.get(customer.id)?.n ?? 0, jobs: jCount.get(customer.id)?.n ?? 0 },
    }));
    return c.json({ data, total, page: paging.page, pageSize: paging.pageSize });
  })

  .get("/:id", async (c) => c.json(await customerDetail(c.var.db, idParam(c), true)))

  .get("/:id/profile", async (c) => c.json(await customerDetail(c.var.db, idParam(c), false)))

  .post("/", requireRole(ROLES.Admin, ROLES.Sales), async (c) => {
    const { db, user } = c.var;
    const input = await readJson(c, customerSchema);
    const created = await db.transaction(async (tx) => {
      const columns = toColumns(input);
      const [row] = await tx
        .insert(customers)
        .values({ ...columns, name: input.name, customerId: await nextCustomerCode(tx) })
        .returning();
      await recordAudit(tx, { userId: user.id, entity: "customer", entityId: row.id, action: "create", after: row });
      return row;
    });
    return c.json(created, 201);
  })

  .put("/:id", requireRole(ROLES.Admin, ROLES.Sales), async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const input = await readJson(c, customerUpdateSchema);
    const existing = await loadCustomer(db, id);
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(customers).set(toColumns(input)).where(eq(customers.id, id)).returning();
      await recordAudit(tx, { userId: user.id, entity: "customer", entityId: id, action: "update", before: existing, after: row });
      return row;
    });
    return c.json(updated);
  })

  .post("/:id/notes", async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const { note } = await readJson(c, customerNoteSchema);
    await loadCustomer(db, id);
    const [created] = await db.insert(customerNotes).values({ customerId: id, userId: user.id, note }).returning();
    return c.json(created, 201);
  });
