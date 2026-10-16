import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ["warn", "error"],
});

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
