import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth, requireRole } from "../middleware/auth";
import { customerSchema, customerUpdateSchema } from "../../../shared/schemas";
import { recordAudit } from "../services/audit";
import { nextCustomerCode } from "../utils/identifiers";

function toPhoneArray(value?: string | string[]) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const normalized = raw.map((entry) => entry.trim()).filter(Boolean);
  return normalized.length ? normalized : undefined;
}

function buildAddress(input: Record<string, string | undefined>) {
  const address = {
    region: input.addressRegion,
    city: input.addressCity,
    subcity: input.addressSubcity,
    woreda: input.addressWoreda,
    house: input.addressHouse,
  };
  const entries = Object.entries(address).filter(([, value]) => {
    if (typeof value !== "string") return false;
    return value.trim().length > 0;
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeCustomerPayload(payload: Record<string, any>) {
  const {
    customerId: _ignoreCustomerId,
    phone,
    phones,
    addressRegion,
    addressCity,
    addressSubcity,
    addressWoreda,
    addressHouse,
    ...rest
  } = payload;
  const normalizedPhones = toPhoneArray(phones ?? phone);
  const address = buildAddress({ addressRegion, addressCity, addressSubcity, addressWoreda, addressHouse });
  return { data: rest, phones: normalizedPhones, address };
}

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  const { q, standing, page = "1", pageSize = "20", phone, tin, email } = req.query as Record<string, string>;
  const take = Number(pageSize) || 20;
  const skip = (Number(page) - 1) * take;
  const where = {
    AND: [
      standing ? { standing: standing as any } : {},
      q
        ? {
            OR: [
              { name: { contains: q } },
              { company: { contains: q } },
              { customerId: { contains: q } },
              { tin: { contains: q } },
            ],
          }
        : {},
      phone ? { phones: { path: ["0"], string_contains: phone } } : {},
      tin ? { tin: { contains: tin } } : {},
      email ? { email: { contains: email } } : {},
    ],
  } as any;
  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { creditHistory: { orderBy: { createdAt: "desc" }, take: 5 }, _count: { select: { proformas: true, jobs: true } } },
    }),
    prisma.customer.count({ where }),
  ]);
  res.json({ data, total, page: Number(page), pageSize: take });
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: "desc" }, take: 10 },
      proformas: { take: 20, orderBy: { createdAt: "desc" }, include: { items: true } },
      jobs: { take: 20, orderBy: { createdAt: "desc" }, include: { jobItems: true } },
      payments: { take: 5, orderBy: { createdAt: "desc" } },
      creditHistory: { take: 5, orderBy: { createdAt: "desc" } },
      priceHistory: { take: 20, orderBy: { createdAt: "desc" }, include: { item: true, user: true } },
    },
  });
  if (!customer) return res.status(404).json({ message: "Customer not found" });
  res.json(customer);
});

router.post("/", requireRole(["Admin", "Sales"]), async (req: AuthRequest, res) => {
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const normalized = normalizeCustomerPayload(parsed.data as Record<string, any>);
  const code = await nextCustomerCode();
  const created = await prisma.customer.create({
    data: {
      ...(normalized.data as any),
      customerId: code,
      phones: normalized.phones as any,
      address: normalized.address as any,
    },
  });
  await recordAudit({ userId: req.user?.id, entity: "customer", entityId: String(created.id), action: "create", after: created });
  res.status(201).json(created);
});

router.put("/:id", requireRole(["Admin", "Sales"]), async (req: AuthRequest, res) => {
  const parsed = customerUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const id = Number(req.params.id);
  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Customer not found" });
  const normalized = normalizeCustomerPayload(parsed.data as Record<string, any>);
  const updated = await prisma.customer.update({
    where: { id },
    data: {
      ...(normalized.data as any),
      phones: normalized.phones as any,
      address: normalized.address as any,
    },
  });
  await recordAudit({ userId: req.user?.id, entity: "customer", entityId: String(id), action: "update", before: existing, after: updated });
  res.json(updated);
});

router.post("/:id/notes", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const note = String(req.body?.note || "").trim();
  if (!note) return res.status(400).json({ message: "Note required" });
  const created = await prisma.customerNote.create({ data: { customerId: id, userId: req.user?.id, note } });
  res.status(201).json(created);
});

router.get("/:id/profile", async (req, res) => {
  const id = Number(req.params.id);
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      proformas: { orderBy: { createdAt: "desc" }, include: { items: true } },
      jobs: { orderBy: { createdAt: "desc" }, include: { jobItems: true } },
      priceHistory: { orderBy: { createdAt: "desc" }, include: { item: true, user: true } },
      notes: { orderBy: { createdAt: "desc" }, include: { user: true } },
    },
  });
  if (!customer) return res.status(404).json({ message: "Customer not found" });
  res.json(customer);
});

export default router;
