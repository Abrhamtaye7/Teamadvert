// Parsing of multi-line command messages, e.g.
//
//   /newproforma
//   customer: CID0001
//   validity: 15
//   Flex banner 3x2m | 2 | 1,500
//   ITEM0004 | 1
//
// "key: value" lines become fields; lines with "|" are table rows. Everything is stateless: one message = one action.

export type Form = {
  /** Keys lower-cased with spaces, "_" and "-" removed: "Credit limit" → "creditlimit" */
  fields: Map<string, string>;
  rows: string[][];
};

const FIELD = /^([A-Za-z][A-Za-z _-]{0,30}):\s*(.*)$/;

const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s_-]+/g, "");

export function parseForm(lines: string[]): Form {
  const fields = new Map<string, string>();
  const rows: string[][] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.includes("|")) {
      rows.push(line.split("|").map((cell) => cell.trim()));
      continue;
    }
    const match = FIELD.exec(line);
    if (match && normalizeKey(match[1]) !== "items") fields.set(normalizeKey(match[1]), match[2].trim());
  }
  return { fields, rows };
}

export class InputError extends Error {}

/** "1,500.50", "ETB 1500" → 1500.5; throws InputError for anything else. */
export function parseAmount(value: string | undefined, what: string): number {
  const cleaned = (value ?? "").replace(/etb|birr/gi, "").replace(/[,\s]/g, "");
  const number = Number(cleaned);
  if (!cleaned || !Number.isFinite(number) || number < 0) throw new InputError(`${what} must be a number, got "${value ?? ""}"`);
  return number;
}

export const optionalAmount = (value: string | undefined, what: string) => (value?.trim() ? parseAmount(value, what) : undefined);

/** "2", "2 pcs", "1.5 m2" → { quantity, unit } */
export function parseQuantity(value: string | undefined): { quantity: number; unit?: string } {
  const match = /^(\d+(?:\.\d+)?)\s*(.*)$/.exec((value ?? "").trim());
  const quantity = match ? Number(match[1]) : NaN;
  if (!match || !(quantity > 0)) throw new InputError(`Quantity must be a positive number, got "${value ?? ""}"`);
  return { quantity, unit: match[2] || undefined };
}

/** YYYY-MM-DD → the same string, validated. */
export function parseDate(value: string | undefined, what: string): string | undefined {
  if (!value?.trim()) return undefined;
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(text).getTime())) throw new InputError(`${what} must look like 2026-12-31`);
  return text;
}

/** Splits "first rest of text" into ["first", "rest of text"]. */
export function splitFirst(text: string): [string, string] {
  const trimmed = text.trim();
  const space = trimmed.search(/\s/);
  return space < 0 ? [trimmed, ""] : [trimmed.slice(0, space), trimmed.slice(space).trim()];
}

/** Undefined for empty strings, so optional API fields are left out instead of sent blank. */
export const opt = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);
