// Message formatting for Telegram's HTML parse mode (only <b>, <i>, <code>, <pre>, <a> are allowed).

/** Telegram rejects messages longer than 4096 characters. */
const MAX_MESSAGE = 4000;

export const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const b = (value: unknown) => `<b>${esc(value)}</b>`;
export const code = (value: unknown) => `<code>${esc(value)}</code>`;

const moneyFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (value: unknown) => `ETB ${moneyFormat.format(Number(value ?? 0))}`;

const dayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Addis_Ababa", day: "numeric", month: "short", year: "numeric" });
export const day = (value: unknown) => (value ? dayFormat.format(new Date(String(value))) : "—");

/** "pending_approval" → "Pending approval" */
export const label = (value: unknown) => {
  const text = String(value ?? "").replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Cuts a long message at a line break so Telegram accepts it. */
export function fit(text: string, max = MAX_MESSAGE) {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf("\n", max - 20);
  return `${text.slice(0, cut > 0 ? cut : max - 20)}\n…`;
}

/** Joins non-empty lines. */
export const lines = (...parts: (string | false | null | undefined)[]) => parts.filter((p) => p !== false && p !== null && p !== undefined && p !== "").join("\n");
