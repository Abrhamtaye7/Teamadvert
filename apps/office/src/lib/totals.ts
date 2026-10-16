import { COMPANY } from "./company";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Same maths as the API: (qty × price − discount) + VAT; a VAT of 0 means exempt. */
export function lineTotal(line: { quantity: number; sellingPrice: number; discount?: number; vatPercent?: number }) {
  const base = (line.quantity || 0) * (line.sellingPrice || 0);
  const discount = line.discount || 0;
  const vat = ((base - discount) * (line.vatPercent ?? COMPANY.vatPercent)) / 100;
  return { base, discount, vat, total: round2(base - discount + vat) };
}

export function proformaTotals(lines: { quantity: number; sellingPrice: number; discount?: number; vatPercent?: number }[]) {
  const parts = lines.map(lineTotal);
  const sum = (key: "base" | "discount" | "vat" | "total") => round2(parts.reduce((s, p) => s + p[key], 0));
  return { subtotal: sum("base"), discount: sum("discount"), vat: sum("vat"), total: sum("total") };
}

/** What has been paid on a job and what is left. */
export function jobBalance(job: { price: number | null; payments?: { amount: number }[] }) {
  const paid = round2((job.payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0));
  const price = Number(job.price || 0);
  return { price, paid, balance: round2(Math.max(price - paid, 0)) };
}
