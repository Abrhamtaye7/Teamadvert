import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";

/**
 * Client IP. Behind cPanel's Apache/Passenger the nearest proxy appends to X-Forwarded-For,
 * so the right-most entry is the one a client can't forge.
 */
export function clientIp(c: Context): string | undefined {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",").at(-1)?.trim() || undefined;
  try {
    return getConnInfo(c).remote.address;
  } catch {
    return undefined; // no Node socket (tests)
  }
}
