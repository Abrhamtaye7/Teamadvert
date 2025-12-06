"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const schemas_1 = require("../../../shared/schemas");
const audit_1 = require("../services/audit");
const cbeVerifier_1 = require("../services/cbeVerifier");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get("/", async (_req, res) => {
    const payments = await prisma_1.prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { jobOrder: true },
    });
    res.json(payments);
});
router.post("/", (0, auth_1.requireRole)(["Finance", "Admin"]), async (req, res) => {
    const parsed = schemas_1.paymentSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ issues: parsed.error.issues });
    const payload = parsed.data;
    const payment = await prisma_1.prisma.payment.create({ data: { ...payload, customerId: req.body.customerId, createdById: req.user?.id } });
    const job = await prisma_1.prisma.jobOrder.findUnique({ where: { id: payload.jobId }, include: { payments: true } });
    if (job) {
        const totalPaid = job.payments.reduce((sum, p) => sum + Number(p.amount), 0) + payload.amount;
        if (job.price && totalPaid >= Number(job.price)) {
            const nextStatus = payload.method === "Cash" ? "closed" : "finance_review";
            await prisma_1.prisma.jobOrder.update({ where: { id: job.id }, data: { status: nextStatus } });
        }
    }
    await (0, audit_1.recordAudit)({ userId: req.user?.id, entity: "payment", entityId: String(payment.id), action: "create", after: payment });
    res.status(201).json(payment);
});
router.post("/:id/verify", (0, auth_1.requireRole)(["Finance", "Admin"]), async (req, res) => {
    const parsed = schemas_1.cbeVerifySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ issues: parsed.error.issues });
    const id = Number(req.params.id);
    const payment = await prisma_1.prisma.payment.findUnique({ where: { id } });
    if (!payment)
        return res.status(404).json({ message: "Payment not found" });
    const result = await (0, cbeVerifier_1.verifyCbePayment)(parsed.data.transactionNumber, parsed.data.expectedAmount);
    await prisma_1.prisma.payment.update({ where: { id }, data: { verified: result.success, verificationNote: result.issues?.join(", ") } });
    await (0, audit_1.recordAudit)({ userId: req.user?.id, entity: "payment", entityId: String(id), action: "verify", after: result });
    res.json(result);
});
exports.default = router;
