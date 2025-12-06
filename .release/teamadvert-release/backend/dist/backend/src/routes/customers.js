"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const schemas_1 = require("../../../shared/schemas");
const audit_1 = require("../services/audit");
const identifiers_1 = require("../utils/identifiers");
function toPhoneArray(value) {
    const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
    const normalized = raw.map((entry) => entry.trim()).filter(Boolean);
    return normalized.length ? normalized : undefined;
}
function buildAddress(input) {
    const address = {
        region: input.addressRegion,
        city: input.addressCity,
        subcity: input.addressSubcity,
        woreda: input.addressWoreda,
        house: input.addressHouse,
    };
    const entries = Object.entries(address).filter(([, value]) => {
        if (typeof value !== "string")
            return false;
        return value.trim().length > 0;
    });
    return entries.length ? Object.fromEntries(entries) : undefined;
}
function normalizeCustomerPayload(payload) {
    const { customerId: _ignoreCustomerId, phone, phones, addressRegion, addressCity, addressSubcity, addressWoreda, addressHouse, ...rest } = payload;
    const normalizedPhones = toPhoneArray(phones ?? phone);
    const address = buildAddress({ addressRegion, addressCity, addressSubcity, addressWoreda, addressHouse });
    return { data: rest, phones: normalizedPhones, address };
}
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get("/", async (req, res) => {
    const { q, standing, page = "1", pageSize = "20", phone, tin, email } = req.query;
    const take = Number(pageSize) || 20;
    const skip = (Number(page) - 1) * take;
    const where = {
        AND: [
            standing ? { standing: standing } : {},
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
    };
    const [data, total] = await Promise.all([
        prisma_1.prisma.customer.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: "desc" },
            include: { creditHistory: { orderBy: { createdAt: "desc" }, take: 5 }, _count: { select: { proformas: true, jobs: true } } },
        }),
        prisma_1.prisma.customer.count({ where }),
    ]);
    res.json({ data, total, page: Number(page), pageSize: take });
});
router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const customer = await prisma_1.prisma.customer.findUnique({
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
    if (!customer)
        return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
});
router.post("/", (0, auth_1.requireRole)(["Admin", "Sales"]), async (req, res) => {
    const parsed = schemas_1.customerSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ issues: parsed.error.issues });
    const normalized = normalizeCustomerPayload(parsed.data);
    const code = await (0, identifiers_1.nextCustomerCode)();
    const created = await prisma_1.prisma.customer.create({
        data: {
            ...normalized.data,
            customerId: code,
            phones: normalized.phones,
            address: normalized.address,
        },
    });
    await (0, audit_1.recordAudit)({ userId: req.user?.id, entity: "customer", entityId: String(created.id), action: "create", after: created });
    res.status(201).json(created);
});
router.put("/:id", (0, auth_1.requireRole)(["Admin", "Sales"]), async (req, res) => {
    const parsed = schemas_1.customerUpdateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ issues: parsed.error.issues });
    const id = Number(req.params.id);
    const existing = await prisma_1.prisma.customer.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ message: "Customer not found" });
    const normalized = normalizeCustomerPayload(parsed.data);
    const updated = await prisma_1.prisma.customer.update({
        where: { id },
        data: {
            ...normalized.data,
            phones: normalized.phones,
            address: normalized.address,
        },
    });
    await (0, audit_1.recordAudit)({ userId: req.user?.id, entity: "customer", entityId: String(id), action: "update", before: existing, after: updated });
    res.json(updated);
});
router.post("/:id/notes", async (req, res) => {
    const id = Number(req.params.id);
    const note = String(req.body?.note || "").trim();
    if (!note)
        return res.status(400).json({ message: "Note required" });
    const created = await prisma_1.prisma.customerNote.create({ data: { customerId: id, userId: req.user?.id, note } });
    res.status(201).json(created);
});
router.get("/:id/profile", async (req, res) => {
    const id = Number(req.params.id);
    const customer = await prisma_1.prisma.customer.findUnique({
        where: { id },
        include: {
            proformas: { orderBy: { createdAt: "desc" }, include: { items: true } },
            jobs: { orderBy: { createdAt: "desc" }, include: { jobItems: true } },
            priceHistory: { orderBy: { createdAt: "desc" }, include: { item: true, user: true } },
            notes: { orderBy: { createdAt: "desc" }, include: { user: true } },
        },
    });
    if (!customer)
        return res.status(404).json({ message: "Customer not found" });
    res.json(customer);
});
exports.default = router;
