"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get("/", async (req, res) => {
    const { q = "", scope = "all" } = req.query;
    const query = q.toString();
    const limit = 10;
    const results = {};
    if (scope === "all" || scope === "customers") {
        results.customers = await prisma_1.prisma.customer.findMany({
            where: { OR: [{ name: { contains: query } }, { company: { contains: query } }] },
            take: limit,
        });
    }
    if (scope === "all" || scope === "suppliers") {
        results.suppliers = await prisma_1.prisma.supplier.findMany({ where: { companyName: { contains: query } }, take: limit });
    }
    if (scope === "all" || scope === "items") {
        results.items = await prisma_1.prisma.item.findMany({ where: { name: { contains: query } }, take: limit });
    }
    if (scope === "all" || scope === "proformas") {
        results.proformas = await prisma_1.prisma.proforma.findMany({ where: { number: { contains: query } }, take: limit });
    }
    if (scope === "all" || scope === "jobs") {
        results.jobs = await prisma_1.prisma.jobOrder.findMany({ where: { number: { contains: query } }, take: limit });
    }
    if (scope === "all" || scope === "payments") {
        results.payments = await prisma_1.prisma.payment.findMany({ where: { transactionNumber: { contains: query } }, take: limit });
    }
    res.json(results);
});
exports.default = router;
