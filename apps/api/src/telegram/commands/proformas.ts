import type { Keyboard } from "../client";
import { type Action, type Command, type Ctx, hasRole, UsageError } from "../context";
import { b, code, day, esc, label, lines, money } from "../format";
import { InputError, opt, parseForm, splitFirst } from "../forms";
import { findProforma } from "../lookup";
import { customerFromForm, linesFromRows } from "./shared";

const STATUSES = ["draft", "approved", "converted", "expired"];

const FORM = `<pre>/newproforma
customer: CID0001
validity: 15
notes: Delivery in 5 days
Flex banner 3x2m | 2 | 1500
ITEM0004 | 1
Roll-up stand | 1 pcs | 4200 | 200</pre>
• <code>customer:</code> an existing customer's code or name. For someone new use <code>new customer: Name</code> and optional <code>company:</code>, <code>phone:</code>, <code>email:</code>, <code>tin:</code> lines.
• Item lines: <code>name | quantity | unit price | discount</code>. A catalogue code (ITEM0004) fills in the name and price.
• <code>validity</code> (days) and <code>notes</code> are optional. Prices include 15% VAT on top, as in the office.`;

/** Proforma card with totals and the buttons this user may press. */
async function showProforma(ctx: Ctx, id: number) {
  const { proforma: p, totals } = await ctx.api.get(`/proformas/${id}/print`);
  const items = p.items.map(
    (l: any, i: number) => `${i + 1}. ${esc(l.name)} — ${l.quantity}${l.unit ? ` ${esc(l.unit)}` : ""} × ${money(l.sellingPrice)}${Number(l.discount) ? ` − ${money(l.discount)}` : ""}`,
  );
  const text = lines(
    `📄 ${b(`Proforma ${p.number}`)} — ${label(p.status)}`,
    `Customer: ${b(p.customer?.name ?? p.customerSnapshot?.name ?? "—")}${p.customer?.customerId ? ` (${code(p.customer.customerId)})` : ""}`,
    `Date: ${day(p.date)}${p.validity ? ` · valid ${p.validity} days` : ""}`,
    "",
    ...items,
    "",
    `Subtotal: ${money(totals.subtotal)}`,
    Number(totals.discount) ? `Discount: ${money(totals.discount)}` : "",
    `VAT${totals.vatPercent !== null ? ` ${totals.vatPercent}%` : ""}: ${money(totals.vat)}`,
    `${b(`Total: ${money(totals.total)}`)}`,
    p.notes ? `\nNotes: ${esc(p.notes)}` : "",
    `\nPrepared by ${esc(p.preparedBy?.username ?? "—")}${p.approvedBy ? ` · approved by ${esc(p.approvedBy.username)}` : ""}`,
  );
  const row = [];
  if (p.status === "draft" && hasRole(ctx, "Admin")) row.push({ text: "✅ Approve", callback_data: `pa:${p.id}` });
  if (p.status === "approved" && hasRole(ctx, "Admin", "Sales", "Designer")) row.push({ text: "🔁 Convert to job", callback_data: `pc:${p.id}` });
  const keyboard: Keyboard = [...(row.length ? [row] : []), [{ text: "Open in office", url: `${ctx.officeUrl}/proformas/${p.id}` }]];
  await ctx.reply(text, keyboard);
}

async function approve(ctx: Ctx, id: number) {
  const p = await ctx.api.post(`/proformas/${id}/approve`);
  await ctx.reply(`✅ Proforma ${b(p.number)} approved.`);
  await showProforma(ctx, id);
}

async function convert(ctx: Ctx, id: number, description?: string) {
  const job = await ctx.api.post(`/proformas/${id}/convert`, description ? { description } : {});
  await ctx.reply(`🔁 Job order ${b(job.number)} created (pending approval). Send /job ${esc(job.number)} to see it.`);
}

export const proformaCommands: Command[] = [
  {
    name: "proformas",
    group: "Proformas",
    summary: "Latest proformas: /proformas [draft|approved|converted|expired] [search]",
    usage: "<code>/proformas</code> — latest 10\n<code>/proformas draft</code> — only drafts\n<code>/proformas sunrise</code> — search number or customer",
    async run(ctx) {
      const [first, rest] = splitFirst(ctx.args);
      const status = STATUSES.includes(first.toLowerCase()) ? first.toLowerCase() : undefined;
      const q = status ? rest : ctx.args;
      const { data, total } = await ctx.api.get("/proformas", { status, q, pageSize: 10 });
      if (!data.length) return ctx.reply("No proformas found.");
      const rows = data.map((p: any) => {
        const sum = p.items.reduce((s: number, l: any) => s + Number(l.total), 0);
        return `• ${code(p.number)} ${esc(p.customer?.name ?? "")} — ${money(sum)} · ${label(p.status)}`;
      });
      await ctx.reply(lines(b(`Proformas (${data.length} of ${total})`), ...rows, "\nSend /proforma &lt;number&gt; for details."));
    },
  },
  {
    name: "proforma",
    group: "Proformas",
    summary: "Show a proforma: /proforma TAPI-001-26",
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      await showProforma(ctx, (await findProforma(ctx.api, ctx.args)).id);
    },
  },
  {
    name: "newproforma",
    group: "Proformas",
    summary: "Create a proforma (send /newproforma to see the form)",
    usage: FORM,
    async run(ctx) {
      const form = parseForm(ctx.body);
      if (!form.rows.length && !form.fields.size) throw new UsageError();
      const customer = await customerFromForm(ctx.api, form);
      const items = (await linesFromRows(ctx.api, form.rows)).map(({ price, ...l }) => ({ ...l, sellingPrice: price }));
      const validity = opt(form.fields.get("validity"));
      if (validity && !/^\d+$/.test(validity)) throw new InputError("validity must be a number of days");
      const p = await ctx.api.post("/proformas", {
        ...customer,
        validity: validity ? Number(validity) : undefined,
        notes: opt(form.fields.get("notes")),
        items,
      });
      await ctx.reply(`📄 Draft proforma ${b(p.number)} created.`);
      await showProforma(ctx, p.id);
    },
  },
  {
    name: "editproforma",
    group: "Proformas",
    summary: "Change a draft proforma's items, validity or notes",
    usage: `<pre>/editproforma TAPI-001-26
validity: 30
notes: New delivery date
Flex banner 3x2m | 3 | 1500</pre>Item lines replace all the old lines; leave them out to keep the items. Only drafts can be edited.`,
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      const proforma = await findProforma(ctx.api, ctx.args);
      const form = parseForm(ctx.body);
      if (!form.rows.length && !form.fields.size) throw new UsageError();
      const validity = opt(form.fields.get("validity"));
      if (validity && !/^\d+$/.test(validity)) throw new InputError("validity must be a number of days");
      await ctx.api.put(`/proformas/${proforma.id}`, {
        validity: validity ? Number(validity) : undefined,
        notes: opt(form.fields.get("notes")),
        items: form.rows.length ? (await linesFromRows(ctx.api, form.rows)).map(({ price, ...l }) => ({ ...l, sellingPrice: price })) : undefined,
      });
      await ctx.reply(`✏️ Proforma ${b(proforma.number)} updated.`);
      await showProforma(ctx, proforma.id);
    },
  },
  {
    name: "approveproforma",
    group: "Proformas",
    summary: "Approve a draft proforma (Admin): /approveproforma TAPI-001-26",
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      await approve(ctx, (await findProforma(ctx.api, ctx.args)).id);
    },
  },
  {
    name: "convert",
    group: "Proformas",
    summary: "Turn an approved proforma into a job order: /convert TAPI-001-26 [description]",
    async run(ctx) {
      const [ref, description] = splitFirst(ctx.args);
      if (!ref) throw new UsageError();
      await convert(ctx, (await findProforma(ctx.api, ref)).id, description || undefined);
    },
  },
];

export const proformaActions: Action[] = [
  { prefix: "pa", run: (ctx, [id]) => approve(ctx, Number(id)) },
  { prefix: "pc", run: (ctx, [id]) => convert(ctx, Number(id)) },
];
