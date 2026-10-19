import { type Command, type Ctx, UsageError } from "../context";
import { b, code, day, esc, lines, money } from "../format";
import { type Form, InputError, opt, optionalAmount, parseForm } from "../forms";
import { findItem } from "../lookup";
import type { OfficeApi } from "../office";

const FIELDS =
  "<code>name:</code> (required for new items), <code>category:</code>, <code>unit:</code>, <code>base price:</code>, <code>purchase price:</code>, <code>selling price:</code>, <code>notes:</code>";

async function byName(api: OfficeApi, path: string, key: "name" | "unitName", value: string, what: string) {
  const rows = await api.get<any[]>(path);
  const row = rows.find((r) => String(r[key]).toLowerCase() === value.toLowerCase());
  if (!row) throw new InputError(`Unknown ${what} "${value}". Known: ${rows.map((r) => r[key]).join(", ") || "none yet"}`);
  return row.id as number;
}

async function itemFields(api: OfficeApi, form: Form) {
  const f = (key: string) => opt(form.fields.get(key));
  const category = f("category");
  const unit = f("unit");
  return {
    name: f("name"),
    categoryId: category ? await byName(api, "/items/categories", "name", category, "category") : undefined,
    measurementUnitId: unit ? await byName(api, "/items/units", "unitName", unit, "unit") : undefined,
    unit,
    basePrice: optionalAmount(form.fields.get("baseprice"), "base price"),
    purchasePrice: optionalAmount(form.fields.get("purchaseprice"), "purchase price"),
    sellingPrice: optionalAmount(form.fields.get("sellingprice") ?? form.fields.get("price"), "selling price"),
    notes: f("notes"),
  };
}

async function showItem(ctx: Ctx, id: number) {
  const i = await ctx.api.get(`/items/${id}/profile`);
  await ctx.reply(
    lines(
      `📦 ${b(i.name)} ${code(i.itemId)}`,
      i.category ? `Category: ${esc(i.category.name)}` : "",
      i.measurementUnit || i.unit ? `Unit: ${esc(i.measurementUnit?.unitName ?? i.unit)}` : "",
      `Selling: ${money(i.sellingPrice ?? i.basePrice)} · Base: ${money(i.basePrice)} · Purchase: ${money(i.purchasePrice)}`,
      i.notes ? `Notes: ${esc(i.notes)}` : "",
      i.supplierPriceHistory.length
        ? `\n${b("Supplier prices")}\n${i.supplierPriceHistory.slice(0, 8).map((h: any) => `• ${esc(h.supplier?.companyName)} — ${money(h.newPrice)} (${day(h.createdAt)})`).join("\n")}`
        : "",
      i.customerPriceHistory.length
        ? `\n${b("Customer prices")}\n${i.customerPriceHistory.slice(0, 8).map((h: any) => `• ${esc(h.customer?.name)} — ${money(h.newPrice)} (${day(h.createdAt)})`).join("\n")}`
        : "",
    ),
    [[{ text: "Open in office", url: `${ctx.officeUrl}/items/${i.id}` }]],
  );
}

export const itemCommands: Command[] = [
  {
    name: "items",
    group: "Items & prices",
    summary: "Find catalogue items: /items [name or code]",
    async run(ctx) {
      const { data, total } = await ctx.api.get("/items", { q: ctx.args, pageSize: 20 });
      if (!data.length) return ctx.reply("No items found.");
      await ctx.reply(
        lines(
          b(`Items (${data.length} of ${total})`),
          ...data.map((i: any) => `• ${code(i.itemId)} ${esc(i.name)} — ${money(i.sellingPrice ?? i.basePrice)}${i.measurementUnit ? ` / ${esc(i.measurementUnit.unitName)}` : ""}`),
          "\nSend /item &lt;code&gt; for details.",
        ),
      );
    },
  },
  {
    name: "item",
    group: "Items & prices",
    summary: "Show an item with its supplier and customer prices: /item ITEM0001",
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      await showItem(ctx, (await findItem(ctx.api, ctx.args)).id);
    },
  },
  {
    name: "newitem",
    group: "Items & prices",
    summary: "Add a catalogue item (Admin, Sales, Finance)",
    usage: `<pre>/newitem
name: Flex banner (per m²)
category: Large format
unit: m2
selling price: 750
purchase price: 420</pre>Fields: ${FIELDS}`,
    async run(ctx) {
      const fields = await itemFields(ctx.api, parseForm(ctx.body));
      if (!fields.name) throw new UsageError();
      const item = await ctx.api.post("/items", fields);
      await ctx.reply(`📦 Item ${b(item.name)} added as ${code(item.itemId)}.`);
      await showItem(ctx, item.id);
    },
  },
  {
    name: "edititem",
    group: "Items & prices",
    summary: "Change an item's prices or details (Admin, Sales, Finance)",
    usage: `<pre>/edititem ITEM0001
selling price: 800</pre>Only the lines you send are changed. Fields: ${FIELDS}`,
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      const item = await findItem(ctx.api, ctx.args);
      const fields = Object.fromEntries(Object.entries(await itemFields(ctx.api, parseForm(ctx.body))).filter(([, v]) => v !== undefined));
      if (!Object.keys(fields).length) throw new UsageError();
      await ctx.api.put(`/items/${item.id}`, fields);
      await ctx.reply(`✏️ ${b(item.name)} updated.`);
      await showItem(ctx, item.id);
    },
  },
  {
    name: "categories",
    group: "Items & prices",
    summary: "Item categories and units",
    async run(ctx) {
      const [categories, units] = await Promise.all([ctx.api.get<any[]>("/items/categories"), ctx.api.get<any[]>("/items/units")]);
      await ctx.reply(
        lines(
          b("Categories"),
          categories.map((c) => `• ${esc(c.name)}`).join("\n") || "none yet",
          "",
          b("Units"),
          units.map((u) => `• ${esc(u.unitName)}`).join("\n") || "none yet",
          "\nAdd with /newcategory &lt;name&gt; or /newunit &lt;name&gt;.",
        ),
      );
    },
  },
  {
    name: "newcategory",
    group: "Items & prices",
    summary: "Add an item category: /newcategory Large format",
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      const row = await ctx.api.post("/items/categories", { name: ctx.args });
      await ctx.reply(`Category ${b(row.name)} added.`);
    },
  },
  {
    name: "newunit",
    group: "Items & prices",
    summary: "Add a measurement unit: /newunit m2",
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      const row = await ctx.api.post("/items/units", { unitName: ctx.args });
      await ctx.reply(`Unit ${b(row.unitName)} added.`);
    },
  },
];
