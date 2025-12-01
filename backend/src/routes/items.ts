import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth, requireRole } from "../middleware/auth";
import { categorySchema, itemSchema, itemUpdateSchema, unitSchema } from "../../../shared/schemas";
import { recordAudit } from "../services/audit";
import { nextItemCode } from "../utils/identifiers";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { q, categoryId, unitId, amountMin, amountMax, page = "1", pageSize = "20" } = req.query as Record<string, string>;
  const take = Number(pageSize) || 20;
  const skip = (Number(page) - 1) * take;
  const where: any = {};
  if (q) where.OR = [{ name: { contains: q } }, { itemId: { contains: q } }];
  if (categoryId) where.categoryId = Number(categoryId);
  if (unitId) where.measurementUnitId = Number(unitId);
  if (amountMin || amountMax) where.basePrice = { gte: amountMin ? Number(amountMin) : undefined, lte: amountMax ? Number(amountMax) : undefined };
  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { category: true, measurementUnit: true },
    }),
    prisma.item.count({ where }),
  ]);
  res.json({ data: items, total, page: Number(page), pageSize: take });
});

router.get("/:id/profile", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      category: true,
      measurementUnit: true,
      customerPriceHistory: { orderBy: { createdAt: "desc" }, include: { customer: true, user: true } },
      supplierPriceHistory: { orderBy: { createdAt: "desc" }, include: { supplier: true, user: true } },
      proformaItems: { include: { proforma: true }, take: 50 },
      jobItems: { include: { jobOrder: true }, take: 50 },
    },
  });
  if (!item) return res.status(404).json({ message: "Item not found" });
  res.json(item);
});

router.post("/", requireRole(["Admin", "Sales", "Finance"]), async (req: AuthRequest, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const code = await nextItemCode();
  const { customerPrices, supplierPrices, ...data } = parsed.data;
  const created = await prisma.item.create({
    data: { ...data, itemId: code, basePrice: data.basePrice ?? data.sellingPrice },
  });

  if (customerPrices?.length) {
    for (const cp of customerPrices) {
      await prisma.customerPriceHistory.create({
        data: { customerId: cp.customerId, itemId: created.id, newPrice: cp.price, changedBy: req.user?.id },
      });
    }
  }
  if (supplierPrices?.length) {
    for (const sp of supplierPrices) {
      await prisma.supplierPriceHistory.create({
        data: { supplierId: sp.supplierId, itemId: created.id, newPrice: sp.price, changedBy: req.user?.id },
      });
    }
  }

  await recordAudit({ userId: req.user?.id, entity: "item", entityId: String(created.id), action: "create", after: created });
  res.status(201).json(created);
});

router.put("/:id", requireRole(["Admin", "Sales", "Finance"]), async (req: AuthRequest, res) => {
  const parsed = itemUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const id = Number(req.params.id);
  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Item not found" });

  const { customerPrices, supplierPrices, ...data } = parsed.data;
  const updated = await prisma.item.update({ where: { id }, data });
  await recordAudit({ userId: req.user?.id, entity: "item", entityId: String(id), action: "update", before: existing, after: updated });

  if (customerPrices?.length) {
    for (const cp of customerPrices) {
      await prisma.customerPriceHistory.create({
        data: { customerId: cp.customerId, itemId: id, oldPrice: existing.sellingPrice ?? existing.basePrice, newPrice: cp.price, changedBy: req.user?.id },
      });
    }
  }
  if (supplierPrices?.length) {
    for (const sp of supplierPrices) {
      await prisma.supplierPriceHistory.create({
        data: { supplierId: sp.supplierId, itemId: id, oldPrice: existing.purchasePrice, newPrice: sp.price, changedBy: req.user?.id },
      });
    }
  }

  res.json(updated);
});

router.post("/categories", requireRole(["Admin", "Sales", "Finance"]), async (req: AuthRequest, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const cat = await prisma.itemCategory.create({ data: { name: parsed.data.name } });
  res.status(201).json(cat);
});

router.get("/categories", async (_req, res) => {
  const cats = await prisma.itemCategory.findMany({ orderBy: { name: "asc" } });
  res.json(cats);
});

router.post("/units", requireRole(["Admin", "Sales", "Finance"]), async (req: AuthRequest, res) => {
  const parsed = unitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const unit = await prisma.measurementUnit.create({ data: { unitName: parsed.data.unitName } });
  res.status(201).json(unit);
});

router.get("/units", async (_req, res) => {
  const units = await prisma.measurementUnit.findMany({ orderBy: { unitName: "asc" } });
  res.json(units);
});

export default router;
