import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth, requireRole } from "../middleware/auth";
import { paymentSchema, cbeVerifySchema } from "../../../shared/schemas";
import { recordAudit } from "../services/audit";
import { verifyCbePayment } from "../services/cbeVerifier";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const payments = await prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { jobOrder: true } });
  res.json(payments);
});

router.post("/", requireRole(["Finance", "Admin"]), async (req: AuthRequest, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const payload = parsed.data;
  const payment = await prisma.payment.create({ data: { ...payload, customerId: req.body.customerId, createdById: req.user?.id } });

  const job = await prisma.jobOrder.findUnique({ where: { id: payload.jobId }, include: { payments: true } });
  if (job) {
    const totalPaid = job.payments.reduce((sum, p) => sum + Number(p.amount), 0) + payload.amount;
    if (job.price && totalPaid >= Number(job.price)) {
      await prisma.jobOrder.update({ where: { id: job.id }, data: { status: "finance_review" } });
    }
  }

  await recordAudit({ userId: req.user?.id, entity: "payment", entityId: String(payment.id), action: "create", after: payment });
  res.status(201).json(payment);
});

router.post("/:id/verify", requireRole(["Finance", "Admin"]), async (req: AuthRequest, res) => {
  const parsed = cbeVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const id = Number(req.params.id);
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return res.status(404).json({ message: "Payment not found" });
  const result = await verifyCbePayment(parsed.data.transactionNumber, parsed.data.expectedAmount);
  await prisma.payment.update({ where: { id }, data: { verified: result.success, verificationNote: result.issues?.join(", ") } });
  await recordAudit({ userId: req.user?.id, entity: "payment", entityId: String(id), action: "verify", after: result });
  res.json(result);
});

export default router;
