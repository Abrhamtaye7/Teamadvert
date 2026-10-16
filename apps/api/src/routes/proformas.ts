import { and, count, desc, eq, exists, gte, inArray, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { proformaCreateSchema, proformaSearchSchema, proformaUpdateSchema } from "@teamadvert/shared/schemas";
import {
  customers,
  jobItems,
  jobOrders,
  nextJobNumber,
  nextProformaNumber,
  proformaItems,
  proformas,
  users,
  type Db,
  type Tx,
} from "@teamadvert/db";
import { recordAudit } from "../lib/audit";
import { customerSnapshot, resolveCustomer } from "../lib/customers";
import { badRequest, idParam, notFound, readJson } from "../lib/errors";
import { amountToWords, proformaLineTotals, round2, sum } from "../lib/money";
import { notify } from "../lib/notify";
import { contains, dateRange, groupBy, indexBy, numberParam, pagination } from "../lib/query";
import { loadPublicUsers } from "../lib/users";
import { requireAuth, requireRole } from "../middleware/auth";
import { ROLES, type AppEnv } from "../types";

type ProformaRow = typeof proformas.$inferSelect;
type LineInput = { itemId?: number; name: string; description?: string; quantity: number; unit?: string; sellingPrice: number; discount?: number; vatPercent?: number };

const grandTotal = sql<number>`(select coalesce(sum(${proformaItems.total}), 0) from ${proformaItems} where ${proformaItems.proformaId} = ${proformas.id})`;

function toLines(proformaId: number, lines: LineInput[]) {
  return lines.map((line) => {
    const { vatPercent, total } = proformaLineTotals(line);
    return {
      proformaId,
      itemId: line.itemId,
      name: line.name,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      sellingPrice: line.sellingPrice,
      discount: line.discount ?? 0,
      vatPercent,
      total,
    };
  });
}

/** Proformas with customer, items and preparer (legacy include shape). */
async function withRelations(db: Db | Tx, rows: ProformaRow[]) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [lines, customerRows, people] = await Promise.all([
    db.select().from(proformaItems).where(inArray(proformaItems.proformaId, ids)).orderBy(proformaItems.id),
    db.select().from(customers).where(inArray(customers.id, rows.map((r) => r.customerId))),
    loadPublicUsers(db, rows.map((r) => r.preparedById)),
  ]);
  const linesBy = groupBy(lines, (l) => l.proformaId);
  const customerBy = indexBy(customerRows, (x) => x.id);
  return rows.map((p) => ({
    ...p,
    customer: customerBy.get(p.customerId) ?? null,
    items: linesBy.get(p.id) ?? [],
    preparedBy: people.get(p.preparedById) ?? null,
  }));
}

async function loadProforma(db: Db | Tx, id: number) {
  const [row] = await db.select().from(proformas).where(eq(proformas.id, id));
  if (!row) throw notFound("Proforma");
  return row;
}

export const proformaRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const { db } = c.var;
    // Blank query params mean "no filter"
    const raw = Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v.trim() !== ""));
    const parsed = proformaSearchSchema.safeParse(raw);
    if (!parsed.success) throw badRequest("Validation failed", { issues: parsed.error.issues });
    const { q, status, preparedBy, itemName, amountMin, amountMax, startDate, endDate, page, pageSize } = parsed.data;
    const paging = pagination(page, pageSize);

    const conditions: (SQL | undefined)[] = [];
    if (status) conditions.push(eq(proformas.status, status));
    if (q) {
      conditions.push(
        or(
          contains(proformas.number, q),
          exists(db.select({ x: sql`1` }).from(customers).where(and(eq(customers.id, proformas.customerId), contains(customers.name, q)))),
        ),
      );
    }
    if (preparedBy) {
      conditions.push(exists(db.select({ x: sql`1` }).from(users).where(and(eq(users.id, proformas.preparedById), contains(users.username, preparedBy)))));
    }
    if (itemName) {
      conditions.push(
        exists(db.select({ x: sql`1` }).from(proformaItems).where(and(eq(proformaItems.proformaId, proformas.id), contains(proformaItems.name, itemName)))),
      );
    }
    // Filters on the proforma's grand total (legacy matched any single line's total)
    const min = numberParam(amountMin);
    const max = numberParam(amountMax);
    if (min !== undefined) conditions.push(gte(grandTotal, min));
    if (max !== undefined) conditions.push(lte(grandTotal, max));
    const { from, toExclusive } = dateRange(startDate, endDate);
    if (from) conditions.push(gte(proformas.date, from));
    if (toExclusive) conditions.push(lt(proformas.date, toExclusive));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(proformas).where(where).orderBy(desc(proformas.createdAt)).limit(paging.pageSize).offset(paging.offset),
      db.select({ total: count() }).from(proformas).where(where),
    ]);
    return c.json({ data: await withRelations(db, rows), total, page: paging.page, pageSize: paging.pageSize });
  })

  .get("/:id", async (c) => {
    const [proforma] = await withRelations(c.var.db, [await loadProforma(c.var.db, idParam(c))]);
    return c.json(proforma);
  })

  .get("/:id/print", async (c) => {
    const [proforma] = await withRelations(c.var.db, [await loadProforma(c.var.db, idParam(c))]);
    const lines = proforma.items.map((line) => proformaLineTotals(line));
    return c.json({
      proforma,
      totals: {
        subtotal: sum(lines.map((l) => l.base)),
        discount: sum(lines.map((l) => l.discount)),
        vat: sum(lines.map((l) => l.vat)),
        total: sum(proforma.items.map((l) => l.total)),
        amountInWords: proforma.amountInWords,
      },
    });
  })

  .post("/", requireRole(ROLES.Admin, ROLES.Sales, ROLES.Designer), async (c) => {
    const { db, user } = c.var;
    const input = await readJson(c, proformaCreateSchema);
    const created = await db.transaction(async (tx) => {
      const customer = await resolveCustomer(tx, input.customerId, input.customerNew);
      if (!customer) throw badRequest("Customer data is required");
      const [proforma] = await tx
        .insert(proformas)
        .values({
          number: await nextProformaNumber(tx),
          customerId: customer.id,
          preparedById: user.id,
          validity: input.validity,
          notes: input.notes,
          terms: input.terms,
          signaturePath: input.signaturePath,
          stampPath: input.stampPath,
          bankInfoSnapshot: input.bankInfoSnapshot ?? null,
          customerSnapshot: customerSnapshot(customer),
          status: "draft",
        })
        .returning();
      const lines = await tx.insert(proformaItems).values(toLines(proforma.id, input.items)).returning();
      const [row] = await tx
        .update(proformas)
        .set({ amountInWords: amountToWords(sum(lines.map((l) => l.total))) })
        .where(eq(proformas.id, proforma.id))
        .returning();
      await recordAudit(tx, { userId: user.id, entity: "proforma", entityId: row.id, action: "create", after: { ...row, items: lines } });
      return row;
    });
    const [full] = await withRelations(db, [created]);
    return c.json(full, 201);
  })

  .put("/:id", requireRole(ROLES.Admin, ROLES.Sales), async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const input = await readJson(c, proformaUpdateSchema);
    const updated = await db.transaction(async (tx) => {
      const existing = await loadProforma(tx, id);
      if (existing.status !== "draft") throw badRequest("Cannot edit approved proforma");
      let amountInWords = existing.amountInWords;
      if (input.items?.length) {
        await tx.delete(proformaItems).where(eq(proformaItems.proformaId, id));
        const lines = await tx.insert(proformaItems).values(toLines(id, input.items)).returning();
        amountInWords = amountToWords(sum(lines.map((l) => l.total)));
      }
      const [row] = await tx
        .update(proformas)
        .set({
          validity: input.validity ?? existing.validity,
          notes: input.notes ?? existing.notes,
          terms: input.terms ?? existing.terms,
          signaturePath: input.signaturePath ?? existing.signaturePath,
          stampPath: input.stampPath ?? existing.stampPath,
          bankInfoSnapshot: input.bankInfoSnapshot ?? existing.bankInfoSnapshot,
          amountInWords,
        })
        .where(eq(proformas.id, id))
        .returning();
      await recordAudit(tx, { userId: user.id, entity: "proforma", entityId: id, action: "update", before: existing, after: row });
      return row;
    });
    const [full] = await withRelations(db, [updated]);
    return c.json(full);
  })

  .post("/:id/approve", requireRole(ROLES.Admin), async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const updated = await db.transaction(async (tx) => {
      const existing = await loadProforma(tx, id);
      // Conditional update: two admins approving at once can't both succeed
      const [row] = await tx
        .update(proformas)
        .set({ status: "approved" })
        .where(and(eq(proformas.id, id), eq(proformas.status, "draft")))
        .returning();
      if (!row) throw badRequest("Proforma already processed");
      await recordAudit(tx, { userId: user.id, entity: "proforma", entityId: id, action: "approve", before: existing, after: row });
      await notify(tx, "ProformaApproved", `Proforma ${row.number} approved`, { data: { proformaId: id } });
      return row;
    });
    return c.json(updated);
  })

  .post("/:id/convert", requireRole(ROLES.Admin, ROLES.Sales, ROLES.Designer), async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const body = (await c.req.json().catch(() => ({}))) as { description?: unknown };
    const job = await db.transaction(async (tx) => {
      const proforma = await loadProforma(tx, id);
      // Claim the proforma first: a double click can't create two jobs
      const [claimed] = await tx
        .update(proformas)
        .set({ status: "converted" })
        .where(and(eq(proformas.id, id), eq(proformas.status, "approved")))
        .returning();
      if (!claimed) throw badRequest("Only approved proformas can convert");

      const lines = await tx.select().from(proformaItems).where(eq(proformaItems.proformaId, id)).orderBy(proformaItems.id);
      const [created] = await tx
        .insert(jobOrders)
        .values({
          number: await nextJobNumber(tx),
          customerId: proforma.customerId,
          proformaId: id,
          customerSnapshot: proforma.customerSnapshot,
          description: typeof body.description === "string" && body.description ? body.description : `Converted from ${proforma.number}`,
          price: sum(lines.map((l) => l.total)),
          status: "pending_approval",
          createdById: user.id,
        })
        .returning();
      if (lines.length) await tx.insert(jobItems).values(jobLinesFromProforma(created.id, lines));
      await recordAudit(tx, { userId: user.id, entity: "proforma", entityId: id, action: "convert", before: proforma, after: created });
      return created;
    });
    return c.json(job, 201);
  });

/**
 * Job lines from proforma lines. The job price is the VAT-inclusive unit price, so quantity × price = the
 * proforma line total (legacy multiplied the line total by the quantity again).
 */
export function jobLinesFromProforma(jobId: number, lines: (typeof proformaItems.$inferSelect)[]) {
  return lines.map((l) => ({
    jobId,
    itemId: l.itemId,
    name: l.name,
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    price: l.quantity ? round2(l.total / l.quantity) : l.total,
    total: l.total,
  }));
}
