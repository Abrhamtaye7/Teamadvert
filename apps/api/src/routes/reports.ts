import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { jobOrders, payments } from "@teamadvert/db";
import { round2 } from "../lib/money";
import { groupBy } from "../lib/query";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";
import type { JobStatus } from "./jobs";

const OPEN: JobStatus[] = ["pending_approval", "approved", "in_progress", "finance_review"];
const FINANCE_APPROVED: JobStatus[] = ["closed", "approved"]; // legacy definition

/** "YYYY-MM" in Addis Ababa time (legacy used the server's timezone). */
const monthKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit" }).format(date);

/** The first instant of the Addis Ababa month `monthsBack` months before now. */
function monthStart(monthsBack: number, now = new Date()) {
  const [y, m] = monthKey(now).split("-").map(Number);
  const index = y * 12 + (m - 1) - monthsBack;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return { key: `${year}-${String(month).padStart(2, "0")}`, start: new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+03:00`) };
}

export const reportRoutes = new Hono<AppEnv>()
  .use(requireAuth)

  .get("/overview", async (c) => {
    const { db } = c.var;
    const months = Math.min(Math.max(Number(c.req.query("months")) || 6, 1), 12);
    const buckets = new Map<string, { jobs: number; collected: number; outstanding: number }>();
    for (let i = months - 1; i >= 0; i--) buckets.set(monthStart(i).key, { jobs: 0, collected: 0, outstanding: 0 });
    const since = monthStart(months - 1).start;

    const [recentJobs, recentPayments, [{ pendingJobs }], openJobs, [{ financeApproved }]] = await Promise.all([
      db.select({ id: jobOrders.id, price: jobOrders.price, createdAt: jobOrders.createdAt }).from(jobOrders).where(gte(jobOrders.createdAt, since)),
      db
        .select({ amount: payments.amount, createdAt: payments.createdAt, status: jobOrders.status })
        .from(payments)
        .innerJoin(jobOrders, eq(jobOrders.id, payments.jobId))
        .where(gte(payments.createdAt, since)),
      db.select({ pendingJobs: count() }).from(jobOrders).where(inArray(jobOrders.status, OPEN)),
      db.select({ id: jobOrders.id, price: jobOrders.price }).from(jobOrders).where(inArray(jobOrders.status, OPEN)),
      db
        .select({ financeApproved: sql<string>`coalesce(sum(${payments.amount}), 0)` })
        .from(payments)
        .innerJoin(jobOrders, eq(jobOrders.id, payments.jobId))
        .where(inArray(jobOrders.status, FINANCE_APPROVED)),
    ]);

    const jobIds = [...new Set([...recentJobs, ...openJobs].map((j) => j.id))];
    const paidRows = jobIds.length
      ? await db
          .select({ jobId: payments.jobId, paid: sql<string>`sum(${payments.amount})` })
          .from(payments)
          .where(and(inArray(payments.jobId, jobIds)))
          .groupBy(payments.jobId)
      : [];
    const paidBy = groupBy(paidRows, (r) => r.jobId);
    const outstanding = (job: { id: number; price: number | null }) =>
      Math.max((job.price ?? 0) - Number(paidBy.get(job.id)?.[0]?.paid ?? 0), 0);

    for (const job of recentJobs) {
      const bucket = buckets.get(monthKey(job.createdAt));
      if (!bucket) continue;
      bucket.jobs += 1;
      bucket.outstanding = round2(bucket.outstanding + outstanding(job));
    }
    for (const p of recentPayments) {
      const bucket = buckets.get(monthKey(p.createdAt));
      if (bucket && FINANCE_APPROVED.includes(p.status)) bucket.collected = round2(bucket.collected + p.amount);
    }

    const chart = [...buckets.entries()].map(([month, stats]) => ({ month, ...stats }));
    const current = buckets.get(monthKey(new Date())) ?? { jobs: 0, collected: 0, outstanding: 0 };
    return c.json({
      summary: {
        jobsThisMonth: current.jobs,
        collectedThisMonth: current.collected,
        outstandingThisMonth: current.outstanding,
        outstandingTotal: round2(openJobs.reduce((s, j) => s + outstanding(j), 0)),
        pendingJobs,
        financeApprovedTotal: round2(Number(financeApproved)),
      },
      chart,
    });
  });

export { monthKey, monthStart };
