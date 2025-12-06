"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const schemas_1 = require("../../../shared/schemas");
const audit_1 = require("../services/audit");
const identifiers_1 = require("../utils/identifiers");
function supplierPhones(value) {
    const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    const normalized = raw.map((entry) => entry.trim()).filter(Boolean);
    return normalized.length ? normalized : undefined;
}
function normalizeSupplierPayload(payload) {
    const { phone, phones, ...rest } = payload;
    return { data: rest, phones: supplierPhones(phones ?? phone) };
}
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
async function getSupplierDetail(id) {
    const supplier = await prisma_1.prisma.supplier.findUnique({
        where: { id },
        include: {
            priceHistory: { orderBy: { createdAt: "desc" }, include: { item: true, user: true } },
            notes: { orderBy: { createdAt: "desc" }, include: { user: true } },
        },
    });
    if (!supplier)
        return null;
    const seen = new Set();
    const items = [];
    supplier.priceHistory.forEach((entry) => {
        if (!entry.itemId || !entry.item)
            return;
        if (seen.has(entry.itemId))
            return;
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
    const { q } = req.query;
    const where = q
        ? {
            OR: [
                { companyName: { contains: q } },
                { supplierId: { contains: q } },
                { contactPerson: { contains: q } },
                { phones: { path: ["0"], string_contains: q } },
            ],
        }
        : {};
    const suppliers = await prisma_1.prisma.supplier.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { priceHistory: { orderBy: { createdAt: "desc" }, take: 5 }, notes: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    res.json(suppliers);
});
router.post("/", (0, auth_1.requireRole)(["Admin", "Sales", "Finance"]), async (req, res) => {
    const parsed = schemas_1.supplierSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ issues: parsed.error.issues });
    const code = await (0, identifiers_1.nextSupplierCode)();
    const normalized = normalizeSupplierPayload(parsed.data);
    const created = await prisma_1.prisma.supplier.create({
        data: {
            ...normalized.data,
            supplierId: code,
            phones: normalized.phones,
        },
    });
    await (0, audit_1.recordAudit)({ userId: req.user?.id, entity: "supplier", entityId: String(created.id), action: "create", after: created });
    res.status(201).json(created);
});
router.put("/:id", (0, auth_1.requireRole)(["Admin", "Sales", "Finance"]), async (req, res) => {
    const parsed = schemas_1.supplierUpdateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ issues: parsed.error.issues });
    const id = Number(req.params.id);
    const existing = await prisma_1.prisma.supplier.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ message: "Supplier not found" });
    const normalized = normalizeSupplierPayload(parsed.data);
    const updated = await prisma_1.prisma.supplier.update({
        where: { id },
        data: {
            ...normalized.data,
            phones: normalized.phones,
        },
    });
    await (0, audit_1.recordAudit)({ userId: req.user?.id, entity: "supplier", entityId: String(id), action: "update", before: existing, after: updated });
    res.json(updated);
});
router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const detail = await getSupplierDetail(id);
    if (!detail)
        return res.status(404).json({ message: "Supplier not found" });
    res.json(detail);
});
router.post("/:id/items", (0, auth_1.requireRole)(["Admin", "Sales", "Finance"]), async (req, res) => {
    const id = Number(req.params.id);
    const supplier = await prisma_1.prisma.supplier.findUnique({ where: { id } });
    if (!supplier)
        return res.status(404).json({ message: "Supplier not found" });
    const incoming = Array.isArray(req.body?.items) ? req.body.items : Array.isArray(req.body) ? req.body : [];
    const parsed = schemas_1.supplierItemPriceSchema.array().min(1).safeParse(incoming);
    if (!parsed.success)
        return res.status(400).json({ issues: parsed.error.issues });
    for (const entry of parsed.data) {
        const price = Number(entry.price);
        if (Number.isNaN(price))
            continue;
        let item = entry.itemId ? await prisma_1.prisma.item.findUnique({ where: { id: entry.itemId } }) : null;
        if (!item) {
            item = await prisma_1.prisma.item.findFirst({ where: { name: entry.name } });
        }
        if (!item) {
            const code = await (0, identifiers_1.nextItemCode)();
            item = await prisma_1.prisma.item.create({ data: { name: entry.name, itemId: code, basePrice: price } });
        }
        const lastPrice = await prisma_1.prisma.supplierPriceHistory.findFirst({
            where: { supplierId: id, itemId: item.id },
            orderBy: { createdAt: "desc" },
        });
        await prisma_1.prisma.supplierPriceHistory.create({
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
router.post("/:id/notes", async (req, res) => {
    const id = Number(req.params.id);
    const content = String(req.body?.content || "").trim();
    if (!content)
        return res.status(400).json({ message: "Note required" });
    const note = await prisma_1.prisma.supplierNote.create({ data: { supplierId: id, content, createdById: req.user?.id } });
    res.status(201).json(note);
});
exports.default = router;
