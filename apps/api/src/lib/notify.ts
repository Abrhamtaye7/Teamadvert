import { notifications, notificationTypes, type Executor } from "@teamadvert/db";

type NotificationType = (typeof notificationTypes)[number];

/**
 * On-screen notification (PRD §5). Without `userId` it is broadcast to everyone.
 * Pass the transaction when inside one so it only appears if the change commits.
 */
export async function notify(
  db: Executor,
  type: NotificationType,
  message: string,
  { userId, data }: { userId?: number; data?: Record<string, unknown> } = {},
) {
  await db.insert(notifications).values({ type, message, userId, data: data ?? null });
}
