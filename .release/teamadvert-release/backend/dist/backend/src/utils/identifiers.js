"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextProformaNumber = nextProformaNumber;
exports.nextJobNumber = nextJobNumber;
exports.nextCustomerCode = nextCustomerCode;
exports.nextSupplierCode = nextSupplierCode;
exports.nextItemCode = nextItemCode;
const dayjs_1 = __importDefault(require("dayjs"));
const prisma_1 = require("../lib/prisma");
async function nextProformaNumber() {
    const year = (0, dayjs_1.default)().format("YY");
    const start = (0, dayjs_1.default)().startOf("year").toDate();
    const count = await prisma_1.prisma.proforma.count({ where: { createdAt: { gte: start } } });
    return `TAPI-${String(count + 1).padStart(3, "0")}-${year}`;
}
async function nextJobNumber() {
    const year = (0, dayjs_1.default)().format("YY");
    const start = (0, dayjs_1.default)().startOf("year").toDate();
    const count = await prisma_1.prisma.jobOrder.count({ where: { createdAt: { gte: start } } });
    return `TAJO-${String(count + 1).padStart(3, "0")}-${year}`;
}
async function nextCustomerCode() {
    return prisma_1.prisma.$transaction(async (tx) => {
        const last = await tx.customer.findFirst({ orderBy: { createdAt: "desc" }, select: { customerId: true } });
        const lastNum = last?.customerId ? Number(last.customerId.replace("CID", "")) || 0 : 0;
        const next = lastNum + 1;
        return `CID${String(next).padStart(4, "0")}`;
    });
}
async function nextSupplierCode() {
    return prisma_1.prisma.$transaction(async (tx) => {
        const last = await tx.supplier.findFirst({ orderBy: { createdAt: "desc" }, select: { supplierId: true } });
        const lastNum = last?.supplierId ? Number(last.supplierId.replace("SID", "")) || 0 : 0;
        const next = lastNum + 1;
        return `SID${String(next).padStart(4, "0")}`;
    });
}
async function nextItemCode() {
    return prisma_1.prisma.$transaction(async (tx) => {
        const last = await tx.item.findFirst({ orderBy: { createdAt: "desc" }, select: { itemId: true } });
        const lastNum = last?.itemId ? Number(last.itemId.replace("ITEM", "")) || 0 : 0;
        const next = lastNum + 1;
        return `ITEM${String(next).padStart(4, "0")}`;
    });
}
