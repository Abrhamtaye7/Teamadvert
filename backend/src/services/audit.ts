import { prisma } from "../lib/prisma";

export async function recordAudit(params: {
  userId?: number;
  entity: string;
  entityId?: string;
  action: string;
  before?: unknown;
  after?: unknown;
}) {
  const { userId, entity, entityId, action, before, after } = params;
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        entity,
        entityId,
        action,
        before: before as any,
        after: after as any,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
