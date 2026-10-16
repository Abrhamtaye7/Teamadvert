import { ilike, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Case-insensitive "contains" (the legacy MySQL collation was case-insensitive). */
export const contains = (column: AnyPgColumn | SQL, value: string) => ilike(column, `%${escapeLike(value)}%`);

/** Case-insensitive "contains" on a JSON column's text, e.g. a phones array. */
export const jsonContains = (column: AnyPgColumn, value: string) =>
  sql`${column}::text ilike ${`%${escapeLike(value)}%`}`;

export function pagination(page?: string, pageSize?: string, { defaultSize = 20, maxSize = 200 } = {}) {
  const size = Math.min(Math.max(Number(pageSize) || defaultSize, 1), maxSize);
  const pageNumber = Math.max(Number(page) || 1, 1);
  return { page: pageNumber, pageSize: size, offset: (pageNumber - 1) * size };
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ADDIS_OFFSET = "+03:00"; // Ethiopia has no daylight saving time

/**
 * Parses filter dates. A plain YYYY-MM-DD means the whole day in Addis Ababa, so `to` is exclusive at the
 * next midnight (legacy cut the end date off at 00:00 UTC, dropping that day's records).
 */
export function dateRange(from?: string, to?: string) {
  const parse = (value: string, endOfDay: boolean) => {
    if (DATE_ONLY.test(value)) {
      const start = new Date(`${value}T00:00:00${ADDIS_OFFSET}`);
      return endOfDay ? new Date(start.getTime() + 86_400_000) : start;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };
  return {
    from: from ? parse(from, false) : undefined,
    toExclusive: to ? parse(to, true) : undefined,
  };
}

export function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

export function indexBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T> {
  return new Map(rows.map((row) => [key(row), row]));
}

/** Pulls numeric query params, ignoring blanks and junk. */
export function numberParam(value?: string): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
