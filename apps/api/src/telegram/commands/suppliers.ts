import { type Command, type Ctx, UsageError } from "../context";
import { b, code, day, esc, lines, money } from "../format";
import { type Form, InputError, opt, parseAmount, parseForm, splitFirst } from "../forms";
import { findSupplier } from "../lookup";

const FIELDS = "<code>company:</code> (required for new suppliers), <code>contact:</code>, <code>phone:</code>, <code>email:</code>, <code>address:</code>";

function supplierFields(form: Form) {
  const f = (key: string) => opt(form.fields.get(key));
  return { companyName: f("company"), contactPerson: f("contact"), phone: f("phone"), email: f("email"), address: f("address") };
}

async function showSupplier(ctx: Ctx, id: number) {
  const s = await ctx.api.get(`/suppliers/${id}`);
  await ctx.reply(
    lines(
      `🚚 ${b(s.companyName)} ${code(s.supplierId)}`,
      s.contactPerson ? `Contact: ${esc(s.contactPerson)}` : "",
      s.phones?.length ? `📞 ${esc(s.phones.join(", "))}` : "",
      s.email ? `✉️ ${esc(s.email)}` : "",
      s.address ? `📍 ${esc(s.address)}` : "",
      s.items.length ? `\n${b("Latest prices")}\n${s.items.slice(0, 15).map((i: any) => `• ${esc(i.name)} — ${money(i.price)} (${day(i.updatedAt)})`).join("\n")}` : "",
      s.notes.length ? `\n${b("Notes")}\n${s.notes.slice(0, 5).map((n: any) => `• ${esc(n.content)} — ${esc(n.user?.username ?? "")}, ${day(n.createdAt)}`).join("\n")}` : "",
    ),
    [[{ text: "Open in office", url: `${ctx.officeUrl}/suppliers/${s.id}` }]],
  );
}

export const supplierCommands: Command[] = [
  {
    name: "suppliers",
    group: "Suppliers",
    summary: "Find suppliers: /suppliers [name, code, contact, phone]",
    async run(ctx) {
      const rows = await ctx.api.get<any[]>("/suppliers", { q: ctx.args });
      if (!rows.length) return ctx.reply("No suppliers found.");
      await ctx.reply(
        lines(
          b(`Suppliers (${Math.min(rows.length, 20)} of ${rows.length})`),
          ...rows.slice(0, 20).map((s) => `• ${code(s.supplierId)} ${esc(s.companyName)}${s.contactPerson ? ` — ${esc(s.contactPerson)}` : ""}`),
          "\nSend /supplier &lt;code&gt; for details.",
        ),
      );
    },
  },
  {
    name: "supplier",
    group: "Suppliers",
    summary: "Show a supplier with latest prices: /supplier SID0001",
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      await showSupplier(ctx, (await findSupplier(ctx.api, ctx.args)).id);
    },
  },
  {
    name: "newsupplier",
    group: "Suppliers",
    summary: "Add a supplier (Admin, Sales, Finance)",
    usage: `<pre>/newsupplier
company: Addis Vinyl PLC
contact: Hana
phone: 0911223344</pre>Fields: ${FIELDS}`,
    async run(ctx) {
      const fields = supplierFields(parseForm(ctx.body));
      if (!fields.companyName) throw new UsageError();
      const s = await ctx.api.post("/suppliers", fields);
      await ctx.reply(`🚚 Supplier ${b(s.companyName)} added as ${code(s.supplierId)}.`);
      await showSupplier(ctx, s.id);
    },
  },
  {
    name: "editsupplier",
    group: "Suppliers",
    summary: "Change a supplier's details (Admin, Sales, Finance)",
    usage: `<pre>/editsupplier SID0001
phone: 0911223344</pre>Only the lines you send are changed. Fields: ${FIELDS}`,
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      const supplier = await findSupplier(ctx.api, ctx.args);
      const fields = Object.fromEntries(Object.entries(supplierFields(parseForm(ctx.body))).filter(([, v]) => v !== undefined));
      if (!Object.keys(fields).length) throw new UsageError();
      await ctx.api.put(`/suppliers/${supplier.id}`, fields);
      await ctx.reply(`✏️ ${b(supplier.companyName)} updated.`);
      await showSupplier(ctx, supplier.id);
    },
  },
  {
    name: "supplierprice",
    group: "Suppliers",
    summary: "Record supplier prices (Admin, Sales, Finance)",
    usage: `<pre>/supplierprice SID0001
Banner vinyl 440g | 320
ITEM0004 | 1500</pre>One line per item: <code>item name or code | price</code>. Unknown item names are added to the catalogue.`,
    async run(ctx) {
      const supplier = ctx.args ? await findSupplier(ctx.api, ctx.args) : undefined;
      const { rows } = parseForm(ctx.body);
      if (!supplier || !rows.length) throw new UsageError();
      const entries = [];
      for (const [index, [name = "", price]] of rows.entries()) {
        if (!name) throw new InputError(`Line ${index + 1}: the item is missing.`);
        const amount = parseAmount(price, `Line ${index + 1} price`);
        if (/^ITEM\d+$/i.test(name)) {
          const { data } = await ctx.api.get("/items", { q: name, pageSize: 1 });
          if (!data[0]) throw new InputError(`Line ${index + 1}: no item ${name}.`);
          entries.push({ itemId: data[0].id, name: data[0].name, price: amount });
        } else {
          entries.push({ name, price: amount });
        }
      }
      await ctx.api.post(`/suppliers/${supplier.id}/items`, entries);
      await ctx.reply(`💲 ${entries.length} price(s) recorded for ${b(supplier.companyName)}.`);
      await showSupplier(ctx, supplier.id);
    },
  },
  {
    name: "suppliernote",
    group: "Suppliers",
    summary: "Add a note to a supplier: /suppliernote SID0001 Delivery takes 3 days",
    async run(ctx) {
      const [ref, content] = splitFirst([ctx.args, ...ctx.body].join("\n"));
      if (!ref || !content) throw new UsageError();
      const supplier = await findSupplier(ctx.api, ref);
      await ctx.api.post(`/suppliers/${supplier.id}/notes`, { content });
      await ctx.reply(`📝 Note added to ${b(supplier.companyName)}.`);
    },
  },
];
