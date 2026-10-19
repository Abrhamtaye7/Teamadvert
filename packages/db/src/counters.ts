import { sql } from "drizzle-orm";
import type { Executor } from "./client";
import { counters } from "./schema";

const BUSINESS_TIMEZONE = "Africa/Addis_Ababa";

/**
 * Atomically increments and returns the counter for (scope, period), starting at 1.
 * A single upsert: concurrent requests lock the same row, so they can never receive the same value.
 */
export async function nextSequence(db: Executor, scope: string, period: number): Promise<number> {
  const [row] = await db
    .insert(counters)
    .values({ scope, period, value: 1 })
    .onConflictDoUpdate({ target: [counters.scope, counters.period], set: { value: sql`${counters.value} + 1` } })
    .returning({ value: counters.value });
  return row.value;
}

/** Two-digit Gregorian year in Addis Ababa time, e.g. 26. */
export function businessYear(date = new Date()): number {
  const year = new Intl.DateTimeFormat("en", { timeZone: BUSINESS_TIMEZONE, year: "2-digit" }).format(date);
  return Number(year);
}

/** TAJO-001-26 style: prefix, yearly sequence (min `digits` digits, default 3), 2-digit year. */
export function formatYearlyNumber(prefix: string, seq: number, year: number, digits = 3): string {
  return `${prefix}-${String(seq).padStart(digits, "0")}-${String(year).padStart(2, "0")}`;
}

/** CID0001 style: prefix and never-resetting sequence (min 4 digits). */
export function formatCode(prefix: string, seq: number): string {
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function yearly(db: Executor, prefix: string, date?: Date, digits?: number) {
  const year = businessYear(date);
  return formatYearlyNumber(prefix, await nextSequence(db, prefix, year), year, digits);
}

async function code(db: Executor, prefix: string) {
  return formatCode(prefix, await nextSequence(db, prefix, 0));
}

/**
 * Numbering continues from the previous system: the first numbers issued here are TAPI-0520-26 and CID0520.
 * `period` is the 2-digit year for yearly sequences, 0 for never-resetting codes.
 */
export const COUNTER_STARTS = [
  { scope: "TAPI", period: 26, first: 520 },
  { scope: "CID", period: 0, first: 520 },
];

/** Makes each counter issue at least `first` next. Never moves a counter backwards, so it is safe to repeat. */
export async function applyCounterStarts(db: Executor, starts = COUNTER_STARTS) {
  for (const { scope, period, first } of starts) {
    await db
      .insert(counters)
      .values({ scope, period, value: first - 1 })
      .onConflictDoUpdate({ target: [counters.scope, counters.period], set: { value: sql`greatest(${counters.value}, ${first - 1})` } });
  }
}

/** TAPI-0520-26: proformas use 4 digits. */
export const nextProformaNumber = (db: Executor, date?: Date) => yearly(db, "TAPI", date, 4);
export const nextJobNumber = (db: Executor, date?: Date) => yearly(db, "TAJO", date);
export const nextCustomerCode = (db: Executor) => code(db, "CID");
export const nextSupplierCode = (db: Executor) => code(db, "SID");
export const nextItemCode = (db: Executor) => code(db, "ITEM");
