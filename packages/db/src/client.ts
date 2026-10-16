import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Shared hosting caps connections per database user, so keep the pool small.
// postgres-js is pure JavaScript, so the API bundles into one file with no native modules.
export function createDb(url: string, { connectionLimit = 5 } = {}) {
  const client = postgres(url, { max: connectionLimit, onnotice: () => undefined });
  const db = drizzle(client, { casing: "snake_case" });
  return { db, pool: { end: () => client.end() } };
}

export type Db = ReturnType<typeof createDb>["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Anything that can run queries: the db itself or an open transaction. */
export type Executor = Db | Tx;
