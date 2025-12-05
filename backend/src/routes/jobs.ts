import { Router } from "express";
import dayjs from "dayjs";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth, requireRole } from "../middleware/auth";
import { jobSchema, jobSearchSchema } from "../../../shared/schemas";
import { recordAudit } from "../services/audit";
import { nextCustomerCode, nextJobNumber } from "../utils/identifiers";

const router = Router();
router.use(requireAuth);

function snapshotCustomer(c: any) {
  if (!c) return undefined;
  return {
    name: c.name,
    company: c.company,
    phones: c.phones,
    email: c.email,
    tin: c.tin,
    address: c.address,
    customerId: c.customerId,
  };
}

function buildJobItems(items: any[]) {
  return items.map((item) => {
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    return {
      itemId: item.itemId,
      name: item.name,
      description: item.description,
      quantity,
      unit: item.unit,
      price,
      total: quantity * price,
    };
  });
}

router.get("/", async (req, res) => {
  const parsed = jobSearchSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const { q, status, priority, customer, itemName, startDate, endDate, amountMin, amountMax, createdBy, proforma, page = "1", pageSize = "20" } =
    parsed.data;
  const take = Number(pageSize) || 20;
  const skip = (Number(page) - 1) * take;
  const where: any = { AND: [] };
  if (q) where.AND.push({ number: { contains: q } });
  if (status) where.AND.push({ status });
  if (priority) where.AND.push({ priority });
  if (customer) where.AND.push({ customer: { name: { contains: customer } } });
  if (itemName) where.AND.push({ jobItems: { some: { name: { contains: itemName } } } });
  if (proforma) where.AND.push({ proforma: { number: { contains: proforma } } });
  if (createdBy) where.AND.push({ createdBy: { username: { contains: createdBy } } });
  if (startDate || endDate)
    where.AND.push({
      createdAt: { gte: startDate ? new Date(startDate) : undefined, lte: endDate ? new Date(endDate) : undefined },
    });
  if (amountMin || amountMax) {
    where.AND.push({
      jobItems: {
        some: {
          total: {
            gte: amountMin ? Number(amountMin) : undefined,
            lte: amountMax ? Number(amountMax) : undefined,
          },
        },
      },
    });
  }

  const [data, total] = await Promise.all([
    prisma.jobOrder.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { jobItems: true, payments: true, customer: true, proforma: true, createdBy: true },
    }),
    prisma.jobOrder.count({ where }),
  ]);
  res.json({ data, total, page: Number(page), pageSize: take });
});

router.get("/:id/print", async (req, res) => {
  const id = Number(req.params.id);
  const job = await prisma.jobOrder.findUnique({ where: { id }, include: { jobItems: true, customer: true, proforma: true, createdBy: true } });
  if (!job) return res.status(404).json({ message: "Job not found" });
  const total = job.jobItems.reduce((sum, i) => sum + Number(i.total), 0);
  res.json({ job, total });
});

router.post("/", requireRole(["Admin", "Designer", "Sales"]), async (req: AuthRequest, res) => {
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const payload = parsed.data;

  let customerId = payload.customerId;
  let customer;
  if (customerId) {
    customer = await prisma.customer.findUnique({ where: { id: customerId } });
  } else if (payload.customerNew) {
    const code = await nextCustomerCode();
    customer = await prisma.customer.create({
      data: {
        customerId: code,
        name: payload.customerNew.name,
        company: payload.customerNew.company,
        phones: payload.customerNew.phones as any,
        email: payload.customerNew.email,
        tin: payload.customerNew.tin,
        address: payload.customerNew.address as any,
      },
    });
    customerId = customer.id;
  }
  if (!customerId) return res.status(400).json({ message: "Customer required" });
  const customerSnapshot = snapshotCustomer(customer);

  let proformaId: number | undefined;
  let items = payload.jobItems;
  if (payload.proformaNumber) {
    const proforma = await prisma.proforma.findFirst({ where: { number: payload.proformaNumber }, include: { items: true } });
    if (!proforma) return res.status(404).json({ message: "Proforma not found" });
    proformaId = proforma.id;
    items = proforma.items.map((it) => ({
      itemId: it.itemId || undefined,
      name: it.name,
      description: it.description || undefined,
      quantity: Number(it.quantity),
      unit: it.unit || undefined,
      price: Number(it.total),
    }));
  }

  const jobItems = buildJobItems(items);
  const price = jobItems.reduce((sum, i) => sum + Number(i.total), 0);
  const number = await nextJobNumber();

  const job = await prisma.jobOrder.create({
    data: {
      number,
      customerId: customerId!,
      customerSnapshot: customerSnapshot as any,
      proformaId,
      jobType: payload.jobType,
      description: payload.description,
      artworkPath: payload.artworkPath,
      deadline: payload.deadline ? new Date(payload.deadline) : undefined,
      priority: payload.priority || "normal",
      advancePayment: payload.advancePayment,
      price,
      status: "pending_approval",
      createdById: req.user?.id,
      jobItems: { create: jobItems },
    },
    include: { jobItems: true },
  });

  await recordAudit({
    userId: req.user?.id,
    entity: "job",
    entityId: String(job.id),
    action: proformaId ? "create-from-proforma" : "create-manual",
    after: job,
  });
  res.status(201).json(job);
});

router.post("/:id/approve", requireRole(["Admin"]), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const payload = req.body as { price?: number; deadline?: string; priority?: string; advancePayment?: number; adminNotes?: string };
  const existing = await prisma.jobOrder.findUnique({ where: { id }, include: { jobItems: true } });
  if (!existing) return res.status(404).json({ message: "Job not found" });
  const updated = await prisma.jobOrder.update({
    where: { id },
    data: {
      price: payload.price ?? existing.price,
      deadline: payload.deadline ? new Date(payload.deadline) : existing.deadline,
      priority: payload.priority ?? existing.priority,
      advancePayment: payload.advancePayment ?? existing.advancePayment,
      adminNotes: payload.adminNotes ?? existing.adminNotes,
      status: "approved",
      adminApprovedById: req.user?.id,
    },
  });
  await recordAudit({ userId: req.user?.id, entity: "job", entityId: String(id), action: "approve", before: existing, after: updated });
  res.json(updated);
});

router.post("/:id/production", requireRole(["Production", "Admin"]), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const { status } = req.body as { status: string };
  const nextStatus: "completed" | "in_progress" = status === "Completed" || status === "completed" ? "completed" : "in_progress";
  const job = await prisma.jobOrder.update({ where: { id }, data: { status: nextStatus as any } });
  await recordAudit({ userId: req.user?.id, entity: "job", entityId: String(id), action: "production", after: { status: nextStatus } });
  res.json(job);
});

router.post("/:id/finance", requireRole(["Finance", "Admin"]), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const { status } = req.body as { status: string };
  const allowed: ("finance_review" | "closed" | "approved")[] = ["finance_review", "closed", "approved"];
  if (!allowed.includes(status as any)) return res.status(400).json({ message: "Invalid finance status" });

  const job = await prisma.jobOrder.update({ where: { id }, data: { status: status as any }, include: { payments: true } });

  if (status === "closed") {
    await prisma.payment.updateMany({ where: { jobId: id }, data: { verified: true } });
  }

  await recordAudit({ userId: req.user?.id, entity: "job", entityId: String(id), action: "finance", after: { status } });
  res.json(job);
});

export default router;
