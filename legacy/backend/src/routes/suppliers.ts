import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth, requireRole } from "../middleware/auth";
import { supplierSchema, supplierUpdateSchema, supplierItemPriceSchema } from "../../../shared/schemas";
import { recordAudit } from "../services/audit";
import { nextSupplierCode, nextItemCode } from "../utils/identifiers";

function supplierPhones(value?: string | string[]) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const normalized = raw.map((entry) => entry.trim()).filter(Boolean);
  return normalized.length ? normalized : undefined;
}

function normalizeSupplierPayload(payload: Record<string, any>) {
  const { phone, phones, ...rest } = payload;
  return { data: rest, phones: supplierPhones(phones ?? phone) };
}

const router = Router();
router.use(requireAuth);

async function getSupplierDetail(id: number) {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      priceHistory: { orderBy: { createdAt: "desc" }, include: { item: true, user: true } },
      notes: { orderBy: { createdAt: "desc" }, include: { user: true } },
    },
  });
  if (!supplier) return null;
  const seen = new Set<number>();
  const items: Array<{ itemId: number; name: string; price: number; description?: string; updatedAt: Date }> = [];
  supplier.priceHistory.forEach((entry) => {
    if (!entry.itemId || !entry.item) return;
    if (seen.has(entry.itemId)) return;
    seen.add(entry.itemId);
    items.push({
      itemId: entry.itemId,
      name: entry.item.name,
      price: Number(entry.newPrice || 0),
      description: entry.item.notes || undefined,
      updatedAt: entry.createdAt,
    });
  });
  return { ...supplier, items };
}

router.get("/", async (req, res) => {
  const { q } = req.query as Record<string, string>;
  const where: any = q
    ? {
        OR: [
          { companyName: { contains: q } },
          { supplierId: { contains: q } },
          { contactPerson: { contains: q } },
          { phones: { path: ["0"], string_contains: q } },
        ],
      }
    : {};
  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { priceHistory: { orderBy: { createdAt: "desc" }, take: 5 }, notes: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  res.json(suppliers);
});

router.post("/", requireRole(["Admin", "Sales", "Finance"]), async (req: AuthRequest, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const code = await nextSupplierCode();
  const normalized = normalizeSupplierPayload(parsed.data as Record<string, any>);
  const created = await prisma.supplier.create({
    data: {
      ...(normalized.data as any),
      supplierId: code,
      phones: normalized.phones as any,
    },
  });
  await recordAudit({ userId: req.user?.id, entity: "supplier", entityId: String(created.id), action: "create", after: created });
  res.status(201).json(created);
});

router.put("/:id", requireRole(["Admin", "Sales", "Finance"]), async (req: AuthRequest, res) => {
  const parsed = supplierUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const id = Number(req.params.id);
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Supplier not found" });
  const normalized = normalizeSupplierPayload(parsed.data as Record<string, any>);
  const updated = await prisma.supplier.update({
    where: { id },
    data: {
      ...(normalized.data as any),
      phones: normalized.phones as any,
    },
  });
  await recordAudit({ userId: req.user?.id, entity: "supplier", entityId: String(id), action: "update", before: existing, after: updated });
  res.json(updated);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const detail = await getSupplierDetail(id);
  if (!detail) return res.status(404).json({ message: "Supplier not found" });
  res.json(detail);
});

router.post("/:id/items", requireRole(["Admin", "Sales", "Finance"]), async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) return res.status(404).json({ message: "Supplier not found" });
  const incoming = Array.isArray(req.body?.items) ? req.body.items : Array.isArray(req.body) ? req.body : [];
  const parsed = supplierItemPriceSchema.array().min(1).safeParse(incoming);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });

  for (const entry of parsed.data) {
    const price = Number(entry.price);
    if (Number.isNaN(price)) continue;
    let item = entry.itemId ? await prisma.item.findUnique({ where: { id: entry.itemId } }) : null;
    if (!item) {
      item = await prisma.item.findFirst({ where: { name: entry.name } });
    }
    if (!item) {
      const code = await nextItemCode();
      item = await prisma.item.create({ data: { name: entry.name, itemId: code, basePrice: price } });
    }
    const lastPrice = await prisma.supplierPriceHistory.findFirst({
      where: { supplierId: id, itemId: item.id },
      orderBy: { createdAt: "desc" },
    });
    await prisma.supplierPriceHistory.create({
      data: {
        supplierId: id,
        itemId: item.id,
        oldPrice: lastPrice?.newPrice,
        newPrice: price,
        changedBy: req.user?.id,
      },
    });
  }

  const detail = await getSupplierDetail(id);
  res.json(detail);
});

router.post("/:id/notes", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const content = String(req.body?.content || "").trim();
  if (!content) return res.status(400).json({ message: "Note required" });
  const note = await prisma.supplierNote.create({ data: { supplierId: id, content, createdById: req.user?.id } });
  res.status(201).json(note);
});

export default router;
