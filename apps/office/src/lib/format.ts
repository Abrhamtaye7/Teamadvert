const TZ = "Africa/Addis_Ababa";

const moneyFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });

const toNumber = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? 0 : Number(v));

/** "ETB 1,234.50" */
export const money = (v: number | string | null | undefined) => `ETB ${moneyFmt.format(toNumber(v))}`;
export const amount = (v: number | string | null | undefined) => moneyFmt.format(toNumber(v));

/** "16 Oct 2026" in Addis Ababa time */
export const date = (v: string | Date | null | undefined) => (v ? dateFmt.format(new Date(v)) : "—");
export const dateTime = (v: string | Date | null | undefined) => (v ? dateTimeFmt.format(new Date(v)) : "—");

/** "2026-10" → "Oct 26" */
export const monthLabel = (key: string) => monthFmt.format(new Date(`${key}-01T00:00:00Z`));

/** Today as YYYY-MM-DD in Addis Ababa (for date inputs) */
export const todayInput = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

/** Relative time like "5 min ago" for notifications */
export function timeAgo(v: string | Date) {
  const seconds = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days} d ago` : date(v);
}

export const humanize = (s: string | null | undefined) =>
  s ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—";

export const phones = (list: string[] | null | undefined) => (list?.length ? list.join(", ") : "—");
