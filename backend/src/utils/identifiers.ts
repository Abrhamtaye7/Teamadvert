import dayjs from "dayjs";
import { prisma } from "../lib/prisma";

export async function nextProformaNumber() {
  const year = dayjs().format("YY");
  const start = dayjs().startOf("year").toDate();
  const count = await prisma.proforma.count({ where: { createdAt: { gte: start } } });
  return `TAPI-${String(count + 1).padStart(3, "0")}-${year}`;
}

export async function nextJobNumber() {
  const year = dayjs().format("YY");
  const start = dayjs().startOf("year").toDate();
  const count = await prisma.jobOrder.count({ where: { createdAt: { gte: start } } });
  return `TAJO-${String(count + 1).padStart(3, "0")}-${year}`;
}

export async function nextCustomerCode() {
  return prisma.$transaction(async (tx) => {
    const last = await tx.customer.findFirst({ orderBy: { createdAt: "desc" }, select: { customerId: true } });
    const lastNum = last?.customerId ? Number(last.customerId.replace("CID", "")) || 0 : 0;
    const next = lastNum + 1;
    return `CID${String(next).padStart(4, "0")}`;
  });
}

export async function nextSupplierCode() {
  return prisma.$transaction(async (tx) => {
    const last = await tx.supplier.findFirst({ orderBy: { createdAt: "desc" }, select: { supplierId: true } });
    const lastNum = last?.supplierId ? Number(last.supplierId.replace("SID", "")) || 0 : 0;
    const next = lastNum + 1;
    return `SID${String(next).padStart(4, "0")}`;
  });
}

export async function nextItemCode() {
  return prisma.$transaction(async (tx) => {
    const last = await tx.item.findFirst({ orderBy: { createdAt: "desc" }, select: { itemId: true } });
    const lastNum = last?.itemId ? Number(last.itemId.replace("ITEM", "")) || 0 : 0;
    const next = lastNum + 1;
    return `ITEM${String(next).padStart(4, "0")}`;
  });
}
