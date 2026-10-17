import { COMPANY } from "./company";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Same maths as the API: (qty × price − discount) + VAT; a VAT of 0 means exempt.
 * `net` is the line amount shown on screen and on the printout (before VAT).
 */
export function lineTotal(line: { quantity: number; sellingPrice: number; discount?: number; vatPercent?: number }) {
  const base = (line.quantity || 0) * (line.sellingPrice || 0);
  const discount = line.discount || 0;
  const vatPercent = line.vatPercent ?? COMPANY.vatPercent;
  const vat = ((base - discount) * vatPercent) / 100;
  return { base, discount, net: round2(base - discount), vatPercent, vat, total: round2(base - discount + vat) };
}

/** Totals as printed: subtotal = sum of line amounts after discounts; one VAT line (`vatPercent` null when rates differ). */
export function proformaTotals(lines: { quantity: number; sellingPrice: number; discount?: number; vatPercent?: number }[]) {
  const parts = lines.map(lineTotal);
  const sum = (key: "net" | "discount" | "vat" | "total") => round2(parts.reduce((s, p) => s + p[key], 0));
  const rates = new Set(parts.map((p) => p.vatPercent));
  return { subtotal: sum("net"), discount: sum("discount"), vat: sum("vat"), vatPercent: rates.size === 1 ? [...rates][0] : null, total: sum("total") };
}

/** What has been paid on a job and what is left. */
export function jobBalance(job: { price: number | null; payments?: { amount: number }[] }) {
  const paid = round2((job.payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0));
  const price = Number(job.price || 0);
  return { price, paid, balance: round2(Math.max(price - paid, 0)) };
}
