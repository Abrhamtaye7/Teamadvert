import { Router } from "express";
import dayjs from "dayjs";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth, requireRole } from "../middleware/auth";
import { proformaCreateSchema, proformaSearchSchema } from "../../../shared/schemas";
import { recordAudit } from "../services/audit";
import { nextJobNumber, nextProformaNumber } from "../utils/identifiers";
import { amountToWords } from "../utils/amountWords";
import { nextCustomerCode } from "../utils/identifiers";

const router = Router();
router.use(requireAuth);

const DEFAULT_VAT = 15;

function generateCustomerId() {
  const now = dayjs();
  return `CUST-${now.format("YYMMDD")}-${Math.floor(Math.random() * 900 + 100)}`;
}

function buildLineTotals(item: { quantity: number; sellingPrice: number; discount?: number; vatPercent?: number }) {
  const qty = Number(item.quantity || 0);
  const price = Number(item.sellingPrice || 0);
  const discount = Number(item.discount || 0);
  const base = qty * price;
  const vatPercent = item.vatPercent ?? DEFAULT_VAT;
  const vatAmount = ((base - discount) * vatPercent) / 100;
  const total = base - discount + vatAmount;
  return { base, vatAmount, total, vatPercent };
}

router.get("/", async (req, res) => {
  const parsedFilters = proformaSearchSchema.safeParse(req.query);
  if (!parsedFilters.success) return res.status(400).json({ issues: parsedFilters.error.issues });
  const { q, status, preparedBy, startDate, endDate, itemName, amountMin, amountMax, page = "1", pageSize = "20" } =
    parsedFilters.data;
  const take = Number(pageSize) || 20;
  const skip = (Number(page) - 1) * take;
  const where: any = { AND: [] };
  if (status) where.AND.push({ status });
  if (q) where.AND.push({ OR: [{ number: { contains: q } }, { customer: { name: { contains: q } } }] });
  if (preparedBy) where.AND.push({ preparedBy: { username: { contains: preparedBy } } });
  if (itemName) where.AND.push({ items: { some: { name: { contains: itemName } } } });
  if (startDate || endDate)
    where.AND.push({
      date: { gte: startDate ? new Date(startDate) : undefined, lte: endDate ? new Date(endDate) : undefined },
    });
  if (amountMin || amountMax) {
    where.AND.push({
      items: {
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
    prisma.proforma.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { customer: true, items: true, preparedBy: true },
    }),
    prisma.proforma.count({ where }),
  ]);
  res.json({ data, total, page: Number(page), pageSize: take });
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const proforma = await prisma.proforma.findUnique({
    where: { id },
    include: { customer: true, items: true, preparedBy: true },
  });
  if (!proforma) return res.status(404).json({ message: "Proforma not found" });
  res.json(proforma);
});

router.get("/:id/print", async (req, res) => {
  const id = Number(req.params.id);
  const proforma = await prisma.proforma.findUnique({ where: { id }, include: { items: true, preparedBy: true } });
  if (!proforma) return res.status(404).json({ message: "Proforma not found" });
  const subtotal = proforma.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.sellingPrice), 0);
  const discount = proforma.items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
  const vat = proforma.items.reduce((sum, item) => {
    const vatPercent = Number(item.vatPercent || DEFAULT_VAT);
    const base = Number(item.quantity) * Number(item.sellingPrice) - Number(item.discount || 0);
    return sum + (base * vatPercent) / 100;
  }, 0);
  const total = proforma.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  res.json({
    proforma,
    totals: { subtotal, discount, vat, total, amountInWords: proforma.amountInWords },
  });
});

router.post("/", requireRole(["Admin", "Sales", "Designer"]), async (req: AuthRequest, res) => {
  const parsed = proformaCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const payload = parsed.data;

  // Customer validation/registration
  let customerId = payload.customerId;
  let customer;
  if (customerId) {
    customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { proformas: false } });
    if (!customer) return res.status(404).json({ message: "Customer not found" });
  } else if (payload.customerNew) {
    const newId = await nextCustomerCode();
    customer = await prisma.customer.create({
      data: {
        customerId: newId,
        name: payload.customerNew.name,
        company: payload.customerNew.company,
        phones: payload.customerNew.phones ? (payload.customerNew.phones as any) : undefined,
        email: payload.customerNew.email,
        tin: payload.customerNew.tin,
        address: payload.customerNew.address ? (payload.customerNew.address as any) : undefined,
      },
    });
    customerId = customer.id;
  } else {
    return res.status(400).json({ message: "Customer data is required" });
  }

  const number = await nextProformaNumber();
  const itemsPayload = payload.items.map((item) => {
    const { total, vatPercent } = buildLineTotals(item);
    return {
      itemId: item.itemId,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      sellingPrice: item.sellingPrice,
      discount: item.discount ?? 0,
      vatPercent,
      total,
    };
  });

  const grandTotal = itemsPayload.reduce((sum, i) => sum + Number(i.total), 0);
  const amountInWords = amountToWords(grandTotal);
  const customerSnapshot = customer
    ? {
      name: customer.name,
      company: customer.company,
      phones: customer.phones,
      email: customer.email,
      tin: customer.tin,
      address: customer.address,
      customerId: customer.customerId,
    }
    : undefined;

  const created = await prisma.proforma.create({
    data: {
      number,
      customerId: customerId!,
      date: dayjs().toDate(),
      preparedById: req.user!.id,
      validity: payload.validity,
      notes: payload.notes,
      terms: payload.terms,
      signaturePath: payload.signaturePath,
      stampPath: payload.stampPath,
      bankInfoSnapshot: payload.bankInfoSnapshot ? payload.bankInfoSnapshot as any : undefined,
      customerSnapshot,
      amountInWords,
      status: "draft",
      items: { create: itemsPayload },
    },
    include: { items: true, preparedBy: true },
  });

  await recordAudit({
    userId: req.user?.id,
    entity: "proforma",
    entityId: String(created.id),
    action: "create",
    after: created,
  });
  res.status(201).json(created);
});

router.put("/:id", requireRole(["Admin", "Sales"]), async (req: AuthRequest, res) => {
  const parsed = proformaCreateSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const id = Number(req.params.id);
  const existing = await prisma.proforma.findUnique({ where: { id }, include: { items: true } });
  if (!existing) return res.status(404).json({ message: "Proforma not found" });
  if (existing.status !== "draft") return res.status(400).json({ message: "Cannot edit approved proforma" });

  const itemsPayload = parsed.data.items
    ? parsed.data.items.map((item) => {
        const { total, vatPercent } = buildLineTotals(item as any);
        return {
          itemId: (item as any).itemId,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          sellingPrice: item.sellingPrice,
          discount: item.discount ?? 0,
          vatPercent,
          total,
        };
      })
    : undefined;

  const amountInWords =
    itemsPayload && itemsPayload.length
      ? amountToWords(itemsPayload.reduce((sum, i) => sum + Number(i.total), 0))
      : existing.amountInWords;

  const updated = await prisma.proforma.update({
    where: { id },
    data: {
      validity: parsed.data.validity ?? existing.validity,
      notes: parsed.data.notes ?? existing.notes,
      terms: parsed.data.terms ?? existing.terms,
      signaturePath: parsed.data.signaturePath ?? existing.signaturePath,
      stampPath: parsed.data.stampPath ?? existing.stampPath,
      bankInfoSnapshot: parsed.data.bankInfoSnapshot ? (parsed.data.bankInfoSnapshot as any) : existing.bankInfoSnapshot,
      amountInWords,
      items: itemsPayload
        ? {
            deleteMany: {},
            create: itemsPayload,
          }
        : undefined,
    },
    include: { items: true },
  });
  await recordAudit({
    userId: req.user?.id,
    entity: "proforma",
    entityId: String(id),
    action: "update",
    before: existing,
    after: updated,
  });
  res.json(updated);
});

router.post("/:id/approve", requireRole(["Admin"]), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.proforma.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Proforma not found" });
  if (existing.status !== "draft") return res.status(400).json({ message: "Proforma already processed" });
  const updated = await prisma.proforma.update({ where: { id }, data: { status: "approved" } });
  await recordAudit({
    userId: req.user?.id,
    entity: "proforma",
    entityId: String(id),
    action: "approve",
    before: existing,
    after: updated,
  });
  res.json(updated);
});

router.post("/:id/convert", requireRole(["Admin", "Sales", "Designer"]), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const proforma = await prisma.proforma.findUnique({ where: { id }, include: { items: true } });
  if (!proforma) return res.status(404).json({ message: "Proforma not found" });
  if (proforma.status !== "approved") return res.status(400).json({ message: "Only approved proformas can convert" });
  const jobNumber = await nextJobNumber();
  const job = await prisma.jobOrder.create({
    data: {
      number: jobNumber,
      customerId: proforma.customerId,
      proformaId: proforma.id,
      description: req.body?.description || `Converted from ${proforma.number}`,
      price: proforma.items.reduce((sum, item) => sum + Number(item.total), 0),
      jobItems: {
        create: proforma.items.map((item) => ({
          itemId: item.itemId || undefined,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          price: item.total,
          total: item.total,
        })),
      },
      status: "pending_approval",
    },
  });
  await prisma.proforma.update({ where: { id }, data: { status: "converted" } });
  await recordAudit({
    userId: req.user?.id,
    entity: "proforma",
    entityId: String(id),
    action: "convert",
    before: proforma,
    after: job,
  });
  res.status(201).json(job);
});

export default router;
