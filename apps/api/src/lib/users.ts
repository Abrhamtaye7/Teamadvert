import { inArray } from "drizzle-orm";
import { users, type Executor } from "@teamadvert/db";
import { indexBy } from "./query";

/** The only user fields ever embedded in other responses (legacy leaked whole user rows, PIN hash included). */
export type PublicUser = { id: number; username: string };

export async function loadPublicUsers(db: Executor, ids: (number | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is number => typeof id === "number"))];
  if (!unique.length) return new Map<number, PublicUser>();
  const rows = await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, unique));
  return indexBy(rows, (u) => u.id);
}
