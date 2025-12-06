"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAudit = recordAudit;
const prisma_1 = require("../lib/prisma");
async function recordAudit(params) {
    const { userId, entity, entityId, action, before, after } = params;
    try {
        await prisma_1.prisma.auditLog.create({
            data: {
                userId,
                entity,
                entityId,
                action,
                before: before,
                after: after,
            },
        });
    }
    catch (error) {
        console.error("Failed to write audit log", error);
    }
}
