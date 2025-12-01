import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const { q = "", scope = "all" } = req.query as Record<string, string>;
  const query = q.toString();
  const limit = 10;
  const results: Record<string, unknown> = {};

  if (scope === "all" || scope === "customers") {
    results.customers = await prisma.customer.findMany({
      where: { OR: [{ name: { contains: query } }, { company: { contains: query } }] },
      take: limit,
    });
  }
  if (scope === "all" || scope === "suppliers") {
    results.suppliers = await prisma.supplier.findMany({ where: { companyName: { contains: query } }, take: limit });
  }
  if (scope === "all" || scope === "items") {
    results.items = await prisma.item.findMany({ where: { name: { contains: query } }, take: limit });
  }
  if (scope === "all" || scope === "proformas") {
    results.proformas = await prisma.proforma.findMany({ where: { number: { contains: query } }, take: limit });
  }
  if (scope === "all" || scope === "jobs") {
    results.jobs = await prisma.jobOrder.findMany({ where: { number: { contains: query } }, take: limit });
  }
  if (scope === "all" || scope === "payments") {
    results.payments = await prisma.payment.findMany({ where: { transactionNumber: { contains: query } }, take: limit });
  }
  res.json(results);
});

export default router;
