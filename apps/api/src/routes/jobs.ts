import { and, count, desc, eq, exists, gte, inArray, lt, lte, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { jobApproveSchema, jobFinanceSchema, jobProductionSchema, jobSchema, jobSearchSchema } from "@teamadvert/shared/schemas";
import {
  customers,
  jobItems,
  jobOrders,
  jobStatuses,
  nextJobNumber,
  payments,
  proformaItems,
  proformas,
  users,
  type Db,
  type Tx,
} from "@teamadvert/db";
import { recordAudit } from "../lib/audit";
import { customerSnapshot, resolveCustomer } from "../lib/customers";
import { ApiError, badRequest, idParam, notFound, readJson } from "../lib/errors";
import { round2, sum } from "../lib/money";
import { notify } from "../lib/notify";
import { contains, dateRange, groupBy, indexBy, numberParam, pagination } from "../lib/query";
import { loadPublicUsers } from "../lib/users";
import { requireAuth, requireRole } from "../middleware/auth";
import { ROLES, type AppEnv } from "../types";
import { jobLinesFromProforma } from "./proformas";

type JobRow = typeof jobOrders.$inferSelect;
export type JobStatus = (typeof jobStatuses)[number];

/**
 * Allowed workflow moves: pending_approval → approved → in_progress → completed → finance_review → closed.
 * Legacy accepted any status from any state (e.g. "completed" on a job that was never approved).
 */
export const TRANSITIONS: Record<string, { to: JobStatus; from: JobStatus[] }[]> = {
  approve: [{ to: "approved", from: ["pending_approval", "approved"] }],
  production: [
    { to: "in_progress", from: ["approved", "in_progress"] },
    { to: "completed", from: ["approved", "in_progress"] },
  ],
  finance: [
    { to: "finance_review", from: ["completed", "finance_review"] },
    { to: "closed", from: ["completed", "finance_review"] },
    { to: "approved", from: ["finance_review"] }, // send back for rework
  ],
};

function allowedFrom(action: keyof typeof TRANSITIONS, to: JobStatus) {
  return TRANSITIONS[action].find((t) => t.to === to)?.from ?? [];
}

/** Jobs with items, payments, customer, proforma and creator (legacy include shape). */
async function withRelations(db: Db | Tx, rows: JobRow[]) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const proformaIds = rows.map((r) => r.proformaId).filter((x): x is number => x !== null);
  const [lines, paid, customerRows, proformaRows, people] = await Promise.all([
    db.select().from(jobItems).where(inArray(jobItems.jobId, ids)).orderBy(jobItems.id),
    db.select().from(payments).where(inArray(payments.jobId, ids)).orderBy(desc(payments.createdAt)),
    db.select().from(customers).where(inArray(customers.id, rows.map((r) => r.customerId))),
    proformaIds.length ? db.select().from(proformas).where(inArray(proformas.id, proformaIds)) : [],
    loadPublicUsers(db, rows.map((r) => r.createdById)),
  ]);
  const linesBy = groupBy(lines, (l) => l.jobId);
  const paidBy = groupBy(paid, (p) => p.jobId);
  const customerBy = indexBy(customerRows, (x) => x.id);
  const proformaBy = indexBy(proformaRows, (x) => x.id);
  return rows.map((j) => ({
    ...j,
    jobItems: linesBy.get(j.id) ?? [],
    payments: paidBy.get(j.id) ?? [],
    customer: customerBy.get(j.customerId) ?? null,
    proforma: j.proformaId ? (proformaBy.get(j.proformaId) ?? null) : null,
    createdBy: j.createdById ? (people.get(j.createdById) ?? null) : null,
  }));
}

async function loadJob(db: Db | Tx, id: number) {
  const [row] = await db.select().from(jobOrders).where(eq(jobOrders.id, id));
  if (!row) throw notFound("Job");
  return row;
}

/** Moves a job to `to` only if it is currently in one of `from`; otherwise 400 (or 404 if missing). */
async function transition(tx: Tx, id: number, to: JobStatus, from: JobStatus[], extra: Partial<JobRow> = {}) {
  const existing = await loadJob(tx, id);
  const [row] = await tx
    .update(jobOrders)
    .set({ ...extra, status: to })
    .where(and(eq(jobOrders.id, id), inArray(jobOrders.status, from)))
    .returning();
  if (!row) throw badRequest(`Job is ${existing.status.replace("_", " ")}; it can't move to ${to.replace("_", " ")}`);
  return { existing, row };
}

const parseDeadline = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest("Invalid deadline");
  return date;
};

export const jobRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const { db } = c.var;
    const raw = Object.fromEntries(Object.entries(c.req.query()).filter(([, v]) => v.trim() !== ""));
    const parsed = jobSearchSchema.safeParse(raw);
    if (!parsed.success) throw badRequest("Validation failed", { issues: parsed.error.issues });
    const f = parsed.data;
    const paging = pagination(f.page, f.pageSize);

    const conditions: (SQL | undefined)[] = [];
    if (f.q) conditions.push(contains(jobOrders.number, f.q));
    if (f.status) {
      if (!(jobStatuses as readonly string[]).includes(f.status)) throw badRequest("Unknown status");
      conditions.push(eq(jobOrders.status, f.status as JobStatus));
    }
    if (f.priority) conditions.push(eq(jobOrders.priority, f.priority));
    const one = { x: sql`1` };
    if (f.customer) {
      conditions.push(exists(db.select(one).from(customers).where(and(eq(customers.id, jobOrders.customerId), contains(customers.name, f.customer)))));
    }
    if (f.itemName) {
      conditions.push(exists(db.select(one).from(jobItems).where(and(eq(jobItems.jobId, jobOrders.id), contains(jobItems.name, f.itemName)))));
    }
    if (f.proforma) {
      conditions.push(exists(db.select(one).from(proformas).where(and(eq(proformas.id, jobOrders.proformaId), contains(proformas.number, f.proforma)))));
    }
    if (f.createdBy) {
      conditions.push(exists(db.select(one).from(users).where(and(eq(users.id, jobOrders.createdById), contains(users.username, f.createdBy)))));
    }
    const { from, toExclusive } = dateRange(f.startDate, f.endDate);
    if (from) conditions.push(gte(jobOrders.createdAt, from));
    if (toExclusive) conditions.push(lt(jobOrders.createdAt, toExclusive));
    // Filters on the job price (legacy matched any single line's total)
    const min = numberParam(f.amountMin);
    const max = numberParam(f.amountMax);
    if (min !== undefined) conditions.push(gte(jobOrders.price, min));
    if (max !== undefined) conditions.push(lte(jobOrders.price, max));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db.select().from(jobOrders).where(where).orderBy(desc(jobOrders.createdAt)).limit(paging.pageSize).offset(paging.offset),
      db.select({ total: count() }).from(jobOrders).where(where),
    ]);
    return c.json({ data: await withRelations(db, rows), total, page: paging.page, pageSize: paging.pageSize });
  })

  .get("/:id", async (c) => {
    const [job] = await withRelations(c.var.db, [await loadJob(c.var.db, idParam(c))]);
    return c.json(job);
  })

  .get("/:id/print", async (c) => {
    const [job] = await withRelations(c.var.db, [await loadJob(c.var.db, idParam(c))]);
    return c.json({ job, total: sum(job.jobItems.map((l) => l.total)) });
  })

  .post("/", requireRole(ROLES.Admin, ROLES.Designer, ROLES.Sales), async (c) => {
    const { db, user } = c.var;
    const input = await readJson(c, jobSchema);
    const created = await db.transaction(async (tx) => {
      const customer = await resolveCustomer(tx, input.customerId, input.customerNew);
      if (!customer) throw badRequest("Customer required");

      let proformaId: number | undefined;
      let lines;
      const jobId = 0; // placeholder until the job row exists
      if (input.proformaNumber) {
        const [proforma] = await tx.select().from(proformas).where(eq(proformas.number, input.proformaNumber.trim()));
        if (!proforma) throw notFound("Proforma");
        const [already] = await tx.select({ id: jobOrders.id }).from(jobOrders).where(eq(jobOrders.proformaId, proforma.id));
        if (already) throw new ApiError(409, "That proforma already has a job order");
        proformaId = proforma.id;
        lines = jobLinesFromProforma(jobId, await tx.select().from(proformaItems).where(eq(proformaItems.proformaId, proforma.id)).orderBy(proformaItems.id));
      } else {
        lines = input.jobItems.map((l) => ({ jobId, ...l, total: round2(l.quantity * l.price) }));
      }

      const [job] = await tx
        .insert(jobOrders)
        .values({
          number: await nextJobNumber(tx),
          customerId: customer.id,
          customerSnapshot: customerSnapshot(customer),
          proformaId,
          jobType: input.jobType,
          description: input.description,
          artworkPath: input.artworkPath,
          deadline: parseDeadline(input.deadline),
          priority: input.priority ?? "normal",
          advancePayment: input.advancePayment,
          adminNotes: input.adminNotes,
          price: sum(lines.map((l) => l.total)),
          status: "pending_approval",
          createdById: user.id,
        })
        .returning();
      if (lines.length) await tx.insert(jobItems).values(lines.map((l) => ({ ...l, jobId: job.id })));
      await recordAudit(tx, {
        userId: user.id,
        entity: "job",
        entityId: job.id,
        action: proformaId ? "create-from-proforma" : "create-manual",
        after: job,
      });
      return job;
    });
    const [full] = await withRelations(db, [created]);
    return c.json(full, 201);
  })

  .post("/:id/approve", requireRole(ROLES.Admin), async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const input = await readJson(c, jobApproveSchema);
    const updated = await db.transaction(async (tx) => {
      const current = await loadJob(tx, id);
      const { existing, row } = await transition(tx, id, "approved", allowedFrom("approve", "approved"), {
        price: input.price ?? current.price,
        deadline: parseDeadline(input.deadline) ?? current.deadline,
        priority: input.priority ?? current.priority,
        advancePayment: input.advancePayment ?? current.advancePayment,
        adminNotes: input.adminNotes ?? current.adminNotes,
        adminApprovedById: user.id,
      });
      await recordAudit(tx, { userId: user.id, entity: "job", entityId: id, action: "approve", before: existing, after: row });
      if (existing.status === "pending_approval") await notify(tx, "JobApproved", `Job ${row.number} approved`, { data: { jobId: id } });
      return row;
    });
    return c.json(updated);
  })

  .post("/:id/production", requireRole(ROLES.Production, ROLES.Admin), async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const { status } = await readJson(c, jobProductionSchema);
    const updated = await db.transaction(async (tx) => {
      const { existing, row } = await transition(tx, id, status, allowedFrom("production", status));
      await recordAudit(tx, { userId: user.id, entity: "job", entityId: id, action: "production", before: { status: existing.status }, after: { status } });
      if (status === "completed" && existing.status !== "completed") {
        await notify(tx, "JobCompleted", `Job ${row.number} completed — ready for finance`, { data: { jobId: id } });
      }
      return row;
    });
    return c.json(updated);
  })

  .post("/:id/finance", requireRole(ROLES.Finance, ROLES.Admin), async (c) => {
    const { db, user } = c.var;
    const id = idParam(c);
    const { status } = await readJson(c, jobFinanceSchema);
    const updated = await db.transaction(async (tx) => {
      const { existing, row } = await transition(tx, id, status, allowedFrom("finance", status));
      if (status === "closed") await tx.update(payments).set({ verified: true }).where(eq(payments.jobId, id));
      await recordAudit(tx, { userId: user.id, entity: "job", entityId: id, action: "finance", before: { status: existing.status }, after: { status } });
      return row;
    });
    const [full] = await withRelations(db, [updated]);
    return c.json(full);
  });
