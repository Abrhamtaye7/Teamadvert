import { auditLogs, type Executor } from "@teamadvert/db";

type AuditEntry = {
  userId?: number;
  entity: string;
  entityId?: string | number;
  action: string;
  before?: unknown;
  after?: unknown;
};

/**
 * Writes an immutable audit record. Pass the transaction when inside one so the record
 * commits (or rolls back) together with the change it describes.
 */
export async function recordAudit(db: Executor, entry: AuditEntry) {
  await db.insert(auditLogs).values({
    userId: entry.userId,
    entity: entry.entity,
    entityId: entry.entityId === undefined ? undefined : String(entry.entityId),
    action: entry.action,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
