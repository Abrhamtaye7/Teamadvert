import type { InlineButton } from "../client";
import { type Action, type Command, type Ctx, UsageError } from "../context";
import { b, day, esc, label, lines } from "../format";
import { InputError, splitFirst } from "../forms";
import { findCustomer } from "../lookup";

const STATUSES = ["new", "contacted", "converted", "closed"];

function leadText(l: any) {
  return lines(
    `📨 ${b(`Quote request #${l.id}`)} — ${label(l.status)} · ${day(l.createdAt)}`,
    `${b(l.name)}${l.company ? ` (${esc(l.company)})` : ""}`,
    `📞 ${esc(l.phone)}${l.email ? ` · ✉️ ${esc(l.email)}` : ""}`,
    l.service ? `Service: ${esc(l.service)}` : "",
    esc(l.message),
  );
}

const buttonsFor = (l: any): InlineButton[][] => [
  STATUSES.filter((s) => s !== l.status && s !== "converted").map((s) => ({ text: label(s), callback_data: `ls:${l.id}:${s}` })),
];

async function setStatus(ctx: Ctx, id: number, status: string, customerId?: number) {
  const lead = await ctx.api.patch(`/leads/${id}`, { status, customerId });
  await ctx.reply(`Quote request #${lead.id} marked ${b(label(lead.status))}.`);
}

export const leadCommands: Command[] = [
  {
    name: "leads",
    group: "Quote requests",
    summary: "Website quote requests (Admin, Sales): /leads [new|contacted|converted|closed]",
    async run(ctx) {
      const status = ctx.args.toLowerCase() || "new";
      if (!STATUSES.includes(status)) throw new UsageError();
      const rows = (await ctx.api.get<any[]>("/leads", { status })).slice(0, 10);
      if (!rows.length) return ctx.reply(`No ${status} quote requests.`);
      for (const lead of rows) await ctx.reply(leadText(lead), buttonsFor(lead));
    },
  },
  {
    name: "lead",
    group: "Quote requests",
    summary: "Update a quote request: /lead 7 contacted | closed | converted CID0001",
    usage: "<code>/lead 7 contacted</code>\n<code>/lead 7 converted CID0012</code> — links it to the customer you created\n<code>/lead 7 closed</code>",
    async run(ctx) {
      const [idText, rest] = splitFirst(ctx.args);
      const [status, customerRef] = splitFirst(rest);
      const id = Number(idText.replace("#", ""));
      if (!Number.isInteger(id) || id <= 0 || !STATUSES.includes(status.toLowerCase())) throw new UsageError();
      if (customerRef && status.toLowerCase() !== "converted") throw new InputError("Only a converted request is linked to a customer.");
      const customerId = customerRef ? (await findCustomer(ctx.api, customerRef)).id : undefined;
      await setStatus(ctx, id, status.toLowerCase(), customerId);
    },
  },
];

export const leadActions: Action[] = [{ prefix: "ls", run: (ctx, [id, status]) => setStatus(ctx, Number(id), status) }];
