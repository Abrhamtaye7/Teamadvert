import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { supplierItemPriceSchema, supplierNoteSchema, supplierSchema, supplierUpdateSchema } from "@teamadvert/shared/schemas";
import { items, nextItemCode, nextSupplierCode, supplierNotes, supplierPriceHistory, suppliers, type Db } from "@teamadvert/db";
import { recordAudit } from "../lib/audit";
import { toPhoneArray } from "../lib/customers";
import { badRequest, idParam, notFound, readJson } from "../lib/errors";
import { contains, groupBy, jsonContains } from "../lib/query";
import { loadPublicUsers } from "../lib/users";
import { requireAuth, requireRole } from "../middleware/auth";
import { ROLES, type AppEnv } from "../types";

const EDITORS = [ROLES.Admin, ROLES.Sales, ROLES.Finance];

type SupplierInput = ReturnType<typeof supplierUpdateSchema.parse>;

function toColumns(input: SupplierInput) {
  const { supplierId: _ignored, phone, ...rest } = input;
  return { ...rest, ...(phone !== undefined ? { phones: toPhoneArray(phone) ?? null } : {}) };
}

async function loadSupplier(db: Db, id: number) {
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
  if (!supplier) throw notFound("Supplier");
  return supplier;
}

/** Supplier with price history, notes and the latest price per item (legacy shape). */
async function supplierDetail(db: Db, id: number) {
  const supplier = await loadSupplier(db, id);
  const [history, notes] = await Promise.all([
    db
      .select({ history: supplierPriceHistory, item: items })
      .from(supplierPriceHistory)
      .innerJoin(items, eq(items.id, supplierPriceHistory.itemId))
      .where(eq(supplierPriceHistory.supplierId, id))
      .orderBy(desc(supplierPriceHistory.createdAt), desc(supplierPriceHistory.id)),
    db.select().from(supplierNotes).where(eq(supplierNotes.supplierId, id)).orderBy(desc(supplierNotes.createdAt)),
  ]);
  const people = await loadPublicUsers(db, [...history.map((h) => h.history.changedBy), ...notes.map((n) => n.createdById)]);

  const seen = new Set<number>();
  const latest = [];
  for (const { history: h, item } of history) {
    if (seen.has(h.itemId)) continue;
    seen.add(h.itemId);
    latest.push({ itemId: h.itemId, name: item.name, price: h.newPrice, description: item.notes ?? undefined, updatedAt: h.createdAt });
  }

  return {
    ...supplier,
    priceHistory: history.map(({ history: h, item }) => ({ ...h, item, user: h.changedBy ? (people.get(h.changedBy) ?? null) : null })),
    notes: notes.map((n) => ({ ...n, user: n.createdById ? (people.get(n.createdById) ?? null) : null })),
    items: latest,
  };
}

export const supplierRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const { db } = c.var;
    const q = c.req.query("q");
    const rows = await db
      .select()
      .from(suppliers)
      .where(
        q
          ? or(
              contains(suppliers.companyName, q),
              contains(suppliers.supplierId, q),
              contains(suppliers.contactPerson, q),
              jsonContains(suppliers.phones, q),
            )
          : undefined,
      )
      .orderBy(desc(suppliers.createdAt));
    const ids = rows.map((r) => r.id);
    const [history, notes] = ids.length
      ? await Promise.all([
          db.select().from(supplierPriceHistory).where(inArray(supplierPriceHistory.supplierId, ids)).orderBy(desc(supplierPriceHistory.createdAt)),
          db.select().from(supplierNotes).where(inArray(supplierNotes.supplierId, ids)).orderBy(desc(supplierNotes.createdAt)),
        ])
      : [[], []];
    const historyBy = groupBy(history, (h) => h.supplierId);
    const notesBy = groupBy(notes, (n) => n.supplierId);
    return c.json(
      rows.map((s) => ({
        ...s,
        priceHistory: (historyBy.get(s.id) ?? []).slice(0, 5),
        notes: (notesBy.get(s.id) ?? []).slice(0, 5),
      })),
    );
  })

  .get("/:id", async (c) => c.json(await supplierDetail(c.var.db, idParam(c))))

  .post("/", requireRole(...EDITORS), async (c) => {
    const { db, user } = c.var;
    const input = await readJson(c, supplierSchema);
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(suppliers)
        .values({ ...toColumns(input), companyName: input.companyName, supplierId: await nextSupplierCode(tx) })
        .returning();
      await recordAudit(tx, { userId: user.id, entity: "supplier", entityId: row.id, action: "create", after: row });
      return row;
    });
    return c.json(created, 201);
  })

  .put("/:id", requireRole(...EDITORS), async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const input = await readJson(c, supplierUpdateSchema);
    const existing = await loadSupplier(db, id);
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(suppliers).set(toColumns(input)).where(eq(suppliers.id, id)).returning();
      await recordAudit(tx, { userId: user.id, entity: "supplier", entityId: id, action: "update", before: existing, after: row });
      return row;
    });
    return c.json(updated);
  })

  /** Records supplier prices; unknown items are created (matched by id, else by name case-insensitively). */
  .post("/:id/items", requireRole(...EDITORS), async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    await loadSupplier(db, id);
    const body = (await c.req.json().catch(() => null)) as unknown;
    const incoming = Array.isArray(body) ? body : Array.isArray((body as { items?: unknown })?.items) ? (body as { items: unknown[] }).items : [];
    const parsed = supplierItemPriceSchema.array().min(1).safeParse(incoming);
    if (!parsed.success) throw badRequest("Validation failed", { issues: parsed.error.issues });

    await db.transaction(async (tx) => {
      for (const entry of parsed.data) {
        let [item] = entry.itemId ? await tx.select().from(items).where(eq(items.id, entry.itemId)) : [];
        if (!item) {
          [item] = await tx.select().from(items).where(eq(sql`lower(${items.name})`, entry.name.trim().toLowerCase())).limit(1);
        }
        if (!item) {
          [item] = await tx
            .insert(items)
            .values({ name: entry.name.trim(), itemId: await nextItemCode(tx), basePrice: entry.price })
            .returning();
        }
        const [last] = await tx
          .select({ newPrice: supplierPriceHistory.newPrice })
          .from(supplierPriceHistory)
          .where(sql`${supplierPriceHistory.supplierId} = ${id} and ${supplierPriceHistory.itemId} = ${item.id}`)
          .orderBy(desc(supplierPriceHistory.createdAt), desc(supplierPriceHistory.id))
          .limit(1);
        await tx.insert(supplierPriceHistory).values({
          supplierId: id,
          itemId: item.id,
          oldPrice: last?.newPrice ?? null,
          newPrice: entry.price,
          changedBy: user.id,
        });
      }
      await recordAudit(tx, { userId: user.id, entity: "supplier", entityId: id, action: "prices", after: parsed.data });
    });
    return c.json(await supplierDetail(db, id));
  })

  .post("/:id/notes", async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const { content } = await readJson(c, supplierNoteSchema);
    await loadSupplier(db, id);
    const [note] = await db.insert(supplierNotes).values({ supplierId: id, content, createdById: user.id }).returning();
    return c.json(note, 201);
  });
