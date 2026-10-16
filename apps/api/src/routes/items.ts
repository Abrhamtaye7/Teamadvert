import { and, asc, count, desc, eq, gte, inArray, lte, or, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { categorySchema, itemSchema, itemUpdateSchema, unitSchema } from "@teamadvert/shared/schemas";
import {
  customerPriceHistory,
  customers,
  itemCategories,
  items,
  jobItems,
  jobOrders,
  measurementUnits,
  nextItemCode,
  proformaItems,
  proformas,
  supplierPriceHistory,
  suppliers,
  type Db,
  type Tx,
} from "@teamadvert/db";
import { recordAudit } from "../lib/audit";
import { idParam, notFound, readJson } from "../lib/errors";
import { contains, indexBy, numberParam, pagination } from "../lib/query";
import { loadPublicUsers } from "../lib/users";
import { requireAuth, requireRole } from "../middleware/auth";
import { ROLES, type AppEnv } from "../types";

const EDITORS = [ROLES.Admin, ROLES.Sales, ROLES.Finance];

async function loadItem(db: Db | Tx, id: number) {
  const [item] = await db.select().from(items).where(eq(items.id, id));
  if (!item) throw notFound("Item");
  return item;
}

/** Items with their category and unit objects (legacy include shape). */
async function withLookups(db: Db, rows: (typeof items.$inferSelect)[]) {
  const [cats, units] = await Promise.all([
    db.select().from(itemCategories).where(inArray(itemCategories.id, rows.map((r) => r.categoryId ?? 0))),
    db.select().from(measurementUnits).where(inArray(measurementUnits.id, rows.map((r) => r.measurementUnitId ?? 0))),
  ]);
  const catBy = indexBy(cats, (x) => x.id);
  const unitBy = indexBy(units, (x) => x.id);
  return rows.map((item) => ({
    ...item,
    category: item.categoryId ? (catBy.get(item.categoryId) ?? null) : null,
    measurementUnit: item.measurementUnitId ? (unitBy.get(item.measurementUnitId) ?? null) : null,
  }));
}

export const itemRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  // Static paths first so they don't match "/:id"
  .get("/categories", async (c) => c.json(await c.var.db.select().from(itemCategories).orderBy(asc(itemCategories.name))))
  .post("/categories", requireRole(...EDITORS), async (c) => {
    const { name } = await readJson(c, categorySchema);
    const [row] = await c.var.db.insert(itemCategories).values({ name: name.trim() }).returning();
    return c.json(row, 201);
  })
  .get("/units", async (c) => c.json(await c.var.db.select().from(measurementUnits).orderBy(asc(measurementUnits.unitName))))
  .post("/units", requireRole(...EDITORS), async (c) => {
    const { unitName } = await readJson(c, unitSchema);
    const [row] = await c.var.db.insert(measurementUnits).values({ unitName: unitName.trim() }).returning();
    return c.json(row, 201);
  })

  .get("/", async (c) => {
    const { db } = c.var;
    const { q, categoryId, unitId, amountMin, amountMax, page, pageSize } = c.req.query();
    const paging = pagination(page, pageSize);
    const conditions: (SQL | undefined)[] = [];
    if (q) conditions.push(or(contains(items.name, q), contains(items.itemId, q)));
    const cat = numberParam(categoryId);
    const unit = numberParam(unitId);
    const min = numberParam(amountMin);
    const max = numberParam(amountMax);
    if (cat !== undefined) conditions.push(eq(items.categoryId, cat));
    if (unit !== undefined) conditions.push(eq(items.measurementUnitId, unit));
    if (min !== undefined) conditions.push(gte(items.basePrice, min));
    if (max !== undefined) conditions.push(lte(items.basePrice, max));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(items).where(where).orderBy(desc(items.createdAt)).limit(paging.pageSize).offset(paging.offset),
      db.select({ total: count() }).from(items).where(where),
    ]);
    return c.json({ data: await withLookups(db, rows), total, page: paging.page, pageSize: paging.pageSize });
  })

  .get("/:id/profile", async (c) => {
    const { db } = c.var;
    const id = idParam(c);
    const [item] = await withLookups(db, [await loadItem(db, id)]);
    const [custPrices, supPrices, pItems, jItems] = await Promise.all([
      db
        .select({ history: customerPriceHistory, customer: customers })
        .from(customerPriceHistory)
        .innerJoin(customers, eq(customers.id, customerPriceHistory.customerId))
        .where(eq(customerPriceHistory.itemId, id))
        .orderBy(desc(customerPriceHistory.createdAt)),
      db
        .select({ history: supplierPriceHistory, supplier: suppliers })
        .from(supplierPriceHistory)
        .innerJoin(suppliers, eq(suppliers.id, supplierPriceHistory.supplierId))
        .where(eq(supplierPriceHistory.itemId, id))
        .orderBy(desc(supplierPriceHistory.createdAt)),
      db
        .select({ line: proformaItems, proforma: proformas })
        .from(proformaItems)
        .innerJoin(proformas, eq(proformas.id, proformaItems.proformaId))
        .where(eq(proformaItems.itemId, id))
        .orderBy(desc(proformaItems.createdAt))
        .limit(50),
      db
        .select({ line: jobItems, jobOrder: jobOrders })
        .from(jobItems)
        .innerJoin(jobOrders, eq(jobOrders.id, jobItems.jobId))
        .where(eq(jobItems.itemId, id))
        .orderBy(desc(jobItems.createdAt))
        .limit(50),
    ]);
    const people = await loadPublicUsers(db, [...custPrices.map((p) => p.history.changedBy), ...supPrices.map((p) => p.history.changedBy)]);
    const who = (userId: number | null) => (userId ? (people.get(userId) ?? null) : null);

    return c.json({
      ...item,
      customerPriceHistory: custPrices.map(({ history, customer }) => ({ ...history, customer, user: who(history.changedBy) })),
      supplierPriceHistory: supPrices.map(({ history, supplier }) => ({ ...history, supplier, user: who(history.changedBy) })),
      proformaItems: pItems.map(({ line, proforma }) => ({ ...line, proforma })),
      jobItems: jItems.map(({ line, jobOrder }) => ({ ...line, jobOrder })),
    });
  })

  .post("/", requireRole(...EDITORS), async (c) => {
    const { db, user } = c.var;
    const { customerPrices, supplierPrices, ...data } = await readJson(c, itemSchema);
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(items)
        .values({ ...data, name: data.name.trim(), itemId: await nextItemCode(tx), basePrice: data.basePrice ?? data.sellingPrice })
        .returning();
      if (customerPrices?.length) {
        await tx.insert(customerPriceHistory).values(
          customerPrices.map((cp) => ({ customerId: cp.customerId, itemId: row.id, newPrice: cp.price, changedBy: user.id })),
        );
      }
      if (supplierPrices?.length) {
        await tx.insert(supplierPriceHistory).values(
          supplierPrices.map((sp) => ({ supplierId: sp.supplierId, itemId: row.id, newPrice: sp.price, changedBy: user.id })),
        );
      }
      await recordAudit(tx, { userId: user.id, entity: "item", entityId: row.id, action: "create", after: row });
      return row;
    });
    return c.json(created, 201);
  })

  .put("/:id", requireRole(...EDITORS), async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const { customerPrices, supplierPrices, ...data } = await readJson(c, itemUpdateSchema);
    const updated = await db.transaction(async (tx) => {
      const existing = await loadItem(tx, id);
      const [row] = Object.keys(data).length
        ? await tx.update(items).set(data).where(eq(items.id, id)).returning()
        : [existing];
      if (customerPrices?.length) {
        await tx.insert(customerPriceHistory).values(
          customerPrices.map((cp) => ({
            customerId: cp.customerId,
            itemId: id,
            oldPrice: existing.sellingPrice ?? existing.basePrice,
            newPrice: cp.price,
            changedBy: user.id,
          })),
        );
      }
      if (supplierPrices?.length) {
        await tx.insert(supplierPriceHistory).values(
          supplierPrices.map((sp) => ({
            supplierId: sp.supplierId,
            itemId: id,
            oldPrice: existing.purchasePrice,
            newPrice: sp.price,
            changedBy: user.id,
          })),
        );
      }
      await recordAudit(tx, { userId: user.id, entity: "item", entityId: id, action: "update", before: existing, after: row });
      return row;
    });
    return c.json(updated);
  });
