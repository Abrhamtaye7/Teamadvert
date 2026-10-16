export const DEFAULT_VAT_PERCENT = 15;

/** Rounds to cents, avoiding binary float drift (0.1 + 0.2). */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const sum = (values: number[]) => round2(values.reduce((a, b) => a + b, 0));

/** Proforma line: (qty × price − discount) plus VAT. A vatPercent of 0 means VAT-exempt (not "use default"). */
export function proformaLineTotals(line: { quantity: number; sellingPrice: number; discount?: number | null; vatPercent?: number | null }) {
  const base = line.quantity * line.sellingPrice;
  const discount = line.discount ?? 0;
  const vatPercent = line.vatPercent ?? DEFAULT_VAT_PERCENT;
  const taxable = base - discount;
  const vat = (taxable * vatPercent) / 100;
  return { base: round2(base), discount: round2(discount), vatPercent, vat: round2(vat), total: round2(taxable + vat) };
}

// ---------- Amount in words (ported from legacy/backend/src/utils/amountWords.ts) ----------

const UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = ["", " thousand", " million", " billion", " trillion"];

function chunkToWords(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${UNITS[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${UNITS[n % 10]}` : ""));
  else if (n > 0) parts.push(UNITS[n]);
  return parts.join(" ");
}

export function amountToWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "";
  const totalCents = Math.round(amount * 100);
  const whole = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  if (whole === 0 && cents === 0) return "zero birr";

  const chunks: string[] = [];
  let num = whole;
  for (let scale = 0; num > 0 && scale < SCALES.length; scale++) {
    const chunk = num % 1000;
    if (chunk) chunks.unshift(`${chunkToWords(chunk)}${SCALES[scale]}`.trim());
    num = Math.floor(num / 1000);
  }
  const birr = chunks.join(" ") || "zero";
  return `${birr} birr${cents ? ` and ${chunkToWords(cents)} cents` : ""}`;
}
