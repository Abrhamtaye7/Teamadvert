"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dayjs_1 = __importDefault(require("dayjs"));
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const monthKey = (date) => (0, dayjs_1.default)(date).format("YYYY-MM");
router.get("/overview", async (req, res) => {
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 12);
    const startDate = (0, dayjs_1.default)().subtract(months - 1, "month").startOf("month").toDate();
    const [jobs, payments, pendingJobsCount, openJobs, financePayments] = await Promise.all([
        prisma_1.prisma.jobOrder.findMany({
            where: { createdAt: { gte: startDate } },
            include: { payments: true },
        }),
        prisma_1.prisma.payment.findMany({
            where: { createdAt: { gte: startDate } },
            include: { jobOrder: true },
        }),
        prisma_1.prisma.jobOrder.count({ where: { status: { in: ["pending_approval", "approved", "in_progress", "finance_review"] } } }),
        prisma_1.prisma.jobOrder.findMany({
            where: { status: { in: ["pending_approval", "approved", "in_progress", "finance_review"] } },
            include: { payments: true },
        }),
        prisma_1.prisma.payment.findMany({
            include: { jobOrder: true },
        }),
    ]);
    const monthBuckets = {};
    for (let i = 0; i < months; i += 1) {
        const key = (0, dayjs_1.default)().subtract(months - 1 - i, "month").format("YYYY-MM");
        monthBuckets[key] = { jobs: 0, collected: 0, outstanding: 0 };
    }
    jobs.forEach((job) => {
        const key = monthKey(job.createdAt);
        if (!monthBuckets[key])
            monthBuckets[key] = { jobs: 0, collected: 0, outstanding: 0 };
        monthBuckets[key].jobs += 1;
        const price = Number(job.price || 0);
        const paid = job.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const outstanding = Math.max(price - paid, 0);
        monthBuckets[key].outstanding += outstanding;
    });
    payments.forEach((payment) => {
        const key = monthKey(payment.createdAt);
        if (!monthBuckets[key])
            monthBuckets[key] = { jobs: 0, collected: 0, outstanding: 0 };
        const isFinanceApproved = ["closed", "approved"].includes((payment.jobOrder?.status || "").toLowerCase());
        if (isFinanceApproved)
            monthBuckets[key].collected += Number(payment.amount || 0);
    });
    const chart = Object.entries(monthBuckets)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .map(([month, stats]) => ({ month, ...stats }));
    const currentMonthKey = monthKey(new Date());
    const currentStats = monthBuckets[currentMonthKey] || { jobs: 0, collected: 0, outstanding: 0 };
    const outstandingTotal = openJobs.reduce((sum, job) => {
        const price = Number(job.price || 0);
        const paid = job.payments.reduce((acc, payment) => acc + Number(payment.amount || 0), 0);
        return sum + Math.max(price - paid, 0);
    }, 0);
    const financeApprovedTotal = financePayments.reduce((sum, payment) => {
        const status = (payment.jobOrder?.status || "").toLowerCase();
        if (status === "closed" || status === "approved") {
            return sum + Number(payment.amount || 0);
        }
        return sum;
    }, 0);
    res.json({
        summary: {
            jobsThisMonth: currentStats.jobs,
            collectedThisMonth: currentStats.collected,
            outstandingThisMonth: currentStats.outstanding,
            outstandingTotal,
            pendingJobs: pendingJobsCount,
            financeApprovedTotal,
        },
        chart,
    });
});
exports.default = router;
