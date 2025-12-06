"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.disconnectPrisma = disconnectPrisma;
const client_1 = require("@prisma/client");
exports.prisma = new client_1.PrismaClient({
    log: ["warn", "error"],
});
async function disconnectPrisma() {
    await exports.prisma.$disconnect();
}
