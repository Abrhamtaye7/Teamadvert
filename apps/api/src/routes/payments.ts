import { desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { cbeVerifySchema, paymentSchema } from "@teamadvert/shared/schemas";
import { jobOrders, payments } from "@teamadvert/db";
import { recordAudit } from "../lib/audit";
import { badRequest, idParam, notFound, readJson } from "../lib/errors";
import { round2 } from "../lib/money";
import { notify } from "../lib/notify";
import { indexBy } from "../lib/query";
import { requireAuth, requireRole } from "../middleware/auth";
import { ROLES, type AppEnv } from "../types";
import type { JobStatus } from "./jobs";

/** Payments can be taken from approval (advances) until the job is closed. */
const PAYABLE: JobStatus[] = ["approved", "in_progress", "completed", "finance_review"];
/** A full payment only moves the job forward once production is done. */
const SETTLEABLE: JobStatus[] = ["completed", "finance_review"];

export const paymentRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/", async (c) => {
    const { db } = c.var;
    const rows = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(100);
    const jobs = rows.length ? await db.select().from(jobOrders).where(inArray(jobOrders.id, rows.map((p) => p.jobId))) : [];
    const jobBy = indexBy(jobs, (j) => j.id);
    return c.json(rows.map((p) => ({ ...p, jobOrder: jobBy.get(p.jobId) ?? null })));
  })

  .post("/", requireRole(ROLES.Finance, ROLES.Admin), async (c) => {
    const { db, user } = c.var;
    const input = await readJson(c, paymentSchema);
    const payment = await db.transaction(async (tx) => {
      // Lock the job row so two payments recorded at once see each other's amounts
      const [job] = await tx.select().from(jobOrders).where(eq(jobOrders.id, input.jobId)).for("update");
      if (!job) throw notFound("Job");
      if (!PAYABLE.includes(job.status)) throw badRequest(`Can't record a payment on a job that is ${job.status.replace("_", " ")}`);

      const [created] = await tx
        .insert(payments)
        .values({
          jobId: job.id,
          customerId: job.customerId, // legacy trusted a customerId from the request body
          amount: input.amount,
          method: input.method,
          transactionNumber: input.transactionNumber?.trim() || null,
          referencePath: input.referencePath,
          createdById: user.id,
        })
        .returning();

      const [{ paid }] = await tx
        .select({ paid: sql<string>`coalesce(sum(${payments.amount}), 0)` })
        .from(payments)
        .where(eq(payments.jobId, job.id));
      const fullyPaid = job.price !== null && round2(Number(paid)) >= job.price;
      if (fullyPaid && SETTLEABLE.includes(job.status)) {
        const next: JobStatus = input.method === "Cash" ? "closed" : "finance_review";
        if (next !== job.status) await tx.update(jobOrders).set({ status: next }).where(eq(jobOrders.id, job.id));
      }
      if (input.method === "Bank") {
        await notify(tx, "PaymentPending", `Bank payment of ETB ${input.amount.toFixed(2)} on ${job.number} needs CBE verification`, {
          data: { jobId: job.id, paymentId: created.id },
        });
      }
      await recordAudit(tx, { userId: user.id, entity: "payment", entityId: created.id, action: "create", after: created });
      return created;
    });
    return c.json(payment, 201);
  })

  .post("/:id/verify", requireRole(ROLES.Finance, ROLES.Admin), async (c) => {
    const { db, user, cbeVerifier } = c.var;
    const id = idParam(c);
    const { transactionNumber, expectedAmount } = await readJson(c, cbeVerifySchema);
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    if (!payment) throw notFound("Payment");

    const result = await cbeVerifier(transactionNumber.trim(), expectedAmount);
    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({ verified: result.success, verificationNote: result.issues?.join(", ") ?? null })
        .where(eq(payments.id, id));
      await recordAudit(tx, { userId: user.id, entity: "payment", entityId: id, action: "verify", after: result });
      if (result.success) {
        await notify(tx, "PaymentVerified", `CBE payment ${transactionNumber} verified`, { data: { paymentId: id, jobId: payment.jobId } });
      }
    });
    return c.json(result);
  });
