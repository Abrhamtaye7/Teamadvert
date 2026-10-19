import { type Command, type Ctx, UsageError } from "../context";
import { b, code, day, esc, label, lines, money } from "../format";
import { type Form, InputError, opt, optionalAmount, parseForm, splitFirst } from "../forms";
import { findCustomer } from "../lookup";

const STANDINGS = ["Good", "Warning", "Suspended"];

const FIELDS = `<code>name:</code> (required for new customers), <code>company:</code>, <code>phone:</code> (several: comma separated), <code>email:</code>, <code>tin:</code>, <code>region:</code>, <code>city:</code>, <code>subcity:</code>, <code>woreda:</code>, <code>house:</code>, <code>credit limit:</code>, <code>standing:</code> (Good, Warning, Suspended)`;

/** Form lines → the API's customer fields; lines that are absent stay undefined (unchanged on edit). */
function customerFields(form: Form) {
  const f = (key: string) => opt(form.fields.get(key));
  const standing = f("standing");
  const match = standing ? STANDINGS.find((s) => s.toLowerCase() === standing.toLowerCase()) : undefined;
  if (standing && !match) throw new InputError("standing must be Good, Warning or Suspended");
  return {
    name: f("name"),
    company: f("company"),
    phone: f("phone"),
    email: f("email"),
    tin: f("tin"),
    addressRegion: f("region"),
    addressCity: f("city"),
    addressSubcity: f("subcity"),
    addressWoreda: f("woreda"),
    addressHouse: f("house"),
    creditLimit: optionalAmount(form.fields.get("creditlimit"), "credit limit"),
    standing: match,
  };
}

async function showCustomer(ctx: Ctx, id: number) {
  const c = await ctx.api.get(`/customers/${id}`);
  const address = c.address ? Object.values(c.address).filter(Boolean).join(", ") : "";
  await ctx.reply(
    lines(
      `👤 ${b(c.name)} ${code(c.customerId)}`,
      c.company ? `Company: ${esc(c.company)}` : "",
      c.phones?.length ? `📞 ${esc(c.phones.join(", "))}` : "",
      c.email ? `✉️ ${esc(c.email)}` : "",
      c.tin ? `TIN: ${esc(c.tin)}` : "",
      address ? `📍 ${esc(address)}` : "",
      `Standing: ${esc(c.standing ?? "—")} · Credit limit: ${money(c.creditLimit)} · Outstanding: ${money(c.outstandingBalance)}`,
      c.proformas.length ? `\n${b("Proformas")}\n${c.proformas.slice(0, 5).map((p: any) => `• ${code(p.number)} ${label(p.status)} · ${day(p.date)}`).join("\n")}` : "",
      c.jobs.length ? `\n${b("Jobs")}\n${c.jobs.slice(0, 5).map((j: any) => `• ${code(j.number)} ${money(j.price)} · ${label(j.status)}`).join("\n")}` : "",
      c.notes.length ? `\n${b("Notes")}\n${c.notes.slice(0, 5).map((n: any) => `• ${esc(n.note)} — ${esc(n.user?.username ?? "")}, ${day(n.createdAt)}`).join("\n")}` : "",
    ),
    [[{ text: "Open in office", url: `${ctx.officeUrl}/customers/${c.id}` }]],
  );
}

export const customerCommands: Command[] = [
  {
    name: "customers",
    group: "Customers",
    summary: "Find customers: /customers [name, company, code, TIN]",
    async run(ctx) {
      const { data, total } = await ctx.api.get("/customers", { q: ctx.args, pageSize: 15 });
      if (!data.length) return ctx.reply("No customers found.");
      await ctx.reply(
        lines(
          b(`Customers (${data.length} of ${total})`),
          ...data.map((c: any) => `• ${code(c.customerId)} ${esc(c.name)}${c.company ? ` — ${esc(c.company)}` : ""}${c.phones?.[0] ? ` · ${esc(c.phones[0])}` : ""}`),
          "\nSend /customer &lt;code&gt; for details.",
        ),
      );
    },
  },
  {
    name: "customer",
    group: "Customers",
    summary: "Show a customer with their proformas, jobs and notes: /customer CID0001",
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      await showCustomer(ctx, (await findCustomer(ctx.api, ctx.args)).id);
    },
  },
  {
    name: "newcustomer",
    group: "Customers",
    summary: "Add a customer (Admin, Sales)",
    usage: `<pre>/newcustomer
name: Abebe Kebede
company: Sunrise Trading
phone: 0911000000, 0922000000
city: Addis Ababa
tin: 0012345678</pre>Fields: ${FIELDS}`,
    async run(ctx) {
      const fields = customerFields(parseForm(ctx.body));
      if (!fields.name) throw new UsageError();
      const c = await ctx.api.post("/customers", fields);
      await ctx.reply(`👤 Customer ${b(c.name)} added as ${code(c.customerId)}.`);
      await showCustomer(ctx, c.id);
    },
  },
  {
    name: "editcustomer",
    group: "Customers",
    summary: "Change a customer's details (Admin, Sales)",
    usage: `<pre>/editcustomer CID0001
phone: 0911000000
standing: Warning</pre>Only the lines you send are changed. Fields: ${FIELDS}`,
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      const customer = await findCustomer(ctx.api, ctx.args);
      const fields = Object.fromEntries(Object.entries(customerFields(parseForm(ctx.body))).filter(([, v]) => v !== undefined));
      if (!Object.keys(fields).length) throw new UsageError();
      await ctx.api.put(`/customers/${customer.id}`, fields);
      await ctx.reply(`✏️ ${b(customer.name)} updated.`);
      await showCustomer(ctx, customer.id);
    },
  },
  {
    name: "customernote",
    group: "Customers",
    summary: "Add a note to a customer: /customernote CID0001 Called, will pay Friday",
    async run(ctx) {
      const [ref, note] = splitFirst([ctx.args, ...ctx.body].join("\n"));
      if (!ref || !note) throw new UsageError();
      const customer = await findCustomer(ctx.api, ref);
      await ctx.api.post(`/customers/${customer.id}/notes`, { note });
      await ctx.reply(`📝 Note added to ${b(customer.name)}.`);
    },
  },
];
