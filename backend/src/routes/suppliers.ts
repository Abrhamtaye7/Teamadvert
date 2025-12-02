import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth, requireRole } from "../middleware/auth";
import { supplierSchema, supplierUpdateSchema } from "../../../shared/schemas";
import { recordAudit } from "../services/audit";
import { nextSupplierCode } from "../utils/identifiers";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { q } = req.query as Record<string, string>;
  const suppliers = await prisma.supplier.findMany({
    where: q
      ? {
          OR: [
            { companyName: { contains: q } },
            { supplierId: { contains: q } },
            { contactPerson: { contains: q } },
            { phones: { path: "$[0]", string_contains: q } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    include: { priceHistory: { orderBy: { createdAt: "desc" }, take: 5 }, notes: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  res.json(suppliers);
});

router.post("/", requireRole(["Admin", "Sales", "Finance"]), async (req: AuthRequest, res) => {
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const code = await nextSupplierCode();
  const created = await prisma.supplier.create({ data: { ...parsed.data, supplierId: code } });
  await recordAudit({ userId: req.user?.id, entity: "supplier", entityId: String(created.id), action: "create", after: created });
  res.status(201).json(created);
});

router.put("/:id", requireRole(["Admin", "Sales", "Finance"]), async (req: AuthRequest, res) => {
  const parsed = supplierUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ issues: parsed.error.issues });
  const id = Number(req.params.id);
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: "Supplier not found" });
  const updated = await prisma.supplier.update({ where: { id }, data: parsed.data });
  await recordAudit({ userId: req.user?.id, entity: "supplier", entityId: String(id), action: "update", before: existing, after: updated });
  res.json(updated);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      priceHistory: { orderBy: { createdAt: "desc" }, include: { item: true, user: true } },
      notes: { orderBy: { createdAt: "desc" }, include: { user: true } },
    },
  });
  if (!supplier) return res.status(404).json({ message: "Supplier not found" });
  res.json(supplier);
});

router.post("/:id/notes", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const content = String(req.body?.content || "").trim();
  if (!content) return res.status(400).json({ message: "Note required" });
  const note = await prisma.supplierNote.create({ data: { supplierId: id, content, createdById: req.user?.id } });
  res.status(201).json(note);
});

export default router;
