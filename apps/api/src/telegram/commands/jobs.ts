import type { InlineButton, Keyboard } from "../client";
import { type Action, type Command, type Ctx, hasRole, UsageError } from "../context";
import { b, code, day, esc, label, lines, money } from "../format";
import { InputError, opt, optionalAmount, parseDate, parseForm, splitFirst } from "../forms";
import { findJob, findProforma } from "../lookup";
import { customerFromForm, linesFromRows } from "./shared";

const STATUSES = ["pending_approval", "approved", "in_progress", "completed", "finance_review", "closed"];
const PRIORITIES = ["high", "normal", "low"];

/** What people type → [API action, status]. */
const MOVES: Record<string, ["production" | "finance", string]> = {
  start: ["production", "in_progress"],
  in_progress: ["production", "in_progress"],
  done: ["production", "completed"],
  completed: ["production", "completed"],
  review: ["finance", "finance_review"],
  finance_review: ["finance", "finance_review"],
  close: ["finance", "closed"],
  closed: ["finance", "closed"],
  rework: ["finance", "approved"],
};

const NEW_JOB = `<pre>/newjob
customer: CID0001
type: Signage
description: Shop front sign, Bole branch
deadline: 2026-11-30
priority: high
advance: 5000
3D letters | 1 | 25000
Installation | 1 | 3000</pre>
• Or create it from an approved proforma: <code>proforma: TAPI-001-26</code> (the items are copied; no item lines needed). /convert does the same.
• <code>customer:</code> an existing customer's code or name, or <code>new customer: Name</code>.
• <code>type</code>, <code>description</code>, <code>deadline</code> (YYYY-MM-DD), <code>priority</code> (high/normal/low), <code>advance</code> and <code>notes</code> are optional.
• Item lines: <code>name | quantity | unit price</code> (a catalogue code like ITEM0004 fills in name and price).`;

function priority(value: string | undefined) {
  const p = opt(value)?.toLowerCase();
  if (p && !PRIORITIES.includes(p)) throw new InputError("priority must be high, normal or low");
  return p as "high" | "normal" | "low" | undefined;
}

/** Job card with items, payments and the buttons for the next workflow step this user may take. */
export async function showJob(ctx: Ctx, id: number) {
  const j = await ctx.api.get(`/jobs/${id}`);
  const paid = j.payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const text = lines(
    `🧾 ${b(`Job ${j.number}`)} — ${label(j.status)}${j.priority && j.priority !== "normal" ? ` · ${label(j.priority)} priority` : ""}`,
    `Customer: ${b(j.customer?.name ?? j.customerSnapshot?.name ?? "—")}${j.customer?.customerId ? ` (${code(j.customer.customerId)})` : ""}`,
    j.proforma ? `From proforma ${code(j.proforma.number)}` : "",
    j.jobType ? `Type: ${esc(j.jobType)}` : "",
    j.description ? `Description: ${esc(j.description)}` : "",
    j.deadline ? `Deadline: ${day(j.deadline)}` : "",
    "",
    ...j.jobItems.map((l: any, i: number) => `${i + 1}. ${esc(l.name)} — ${l.quantity}${l.unit ? ` ${esc(l.unit)}` : ""} × ${money(l.price)} = ${money(l.total)}`),
    "",
    `${b(`Price: ${money(j.price)}`)}`,
    `Paid: ${money(paid)} · Balance: ${money(Math.max(Number(j.price ?? 0) - paid, 0))}`,
    j.advancePayment ? `Agreed advance: ${money(j.advancePayment)}` : "",
    ...j.payments.map(
      (p: any) => `  • #${p.id} ${money(p.amount)} ${esc(p.method)}${p.transactionNumber ? ` ${code(p.transactionNumber)}` : ""} — ${p.verified ? "verified" : "not verified"} (${day(p.createdAt)})`,
    ),
    j.adminNotes ? `\nAdmin notes: ${esc(j.adminNotes)}` : "",
    `\nCreated by ${esc(j.createdBy?.username ?? "—")} on ${day(j.createdAt)}`,
  );

  const buttons: InlineButton[] = [];
  const s = j.status;
  if (s === "pending_approval" && hasRole(ctx, "Admin")) buttons.push({ text: "✅ Approve", callback_data: `ja:${j.id}` });
  if (s === "approved" && hasRole(ctx, "Production", "Admin")) buttons.push({ text: "▶️ Start production", callback_data: `jm:${j.id}:start` });
  if ((s === "approved" || s === "in_progress") && hasRole(ctx, "Production", "Admin")) buttons.push({ text: "🏁 Completed", callback_data: `jm:${j.id}:done` });
  if (s === "completed" && hasRole(ctx, "Finance", "Admin")) buttons.push({ text: "🔎 Finance review", callback_data: `jm:${j.id}:review` });
  if ((s === "completed" || s === "finance_review") && hasRole(ctx, "Finance", "Admin")) buttons.push({ text: "🔒 Close", callback_data: `jm:${j.id}:close` });
  if (s === "finance_review" && hasRole(ctx, "Finance", "Admin")) buttons.push({ text: "↩️ Send back", callback_data: `jm:${j.id}:rework` });
  const verify = hasRole(ctx, "Finance", "Admin")
    ? j.payments.filter((p: any) => p.method === "Bank" && !p.verified && p.transactionNumber).map((p: any) => ({ text: `🏦 Verify #${p.id}`, callback_data: `pv:${p.id}` }))
    : [];
  const keyboard: Keyboard = [
    ...(buttons.length ? [buttons.slice(0, 3), ...(buttons.length > 3 ? [buttons.slice(3)] : [])] : []),
    ...(verify.length ? [verify.slice(0, 3)] : []),
    [{ text: "Open in office", url: `${ctx.officeUrl}/jobs/${j.id}` }],
  ];
  await ctx.reply(text, keyboard);
}

async function approve(ctx: Ctx, id: number, body: Record<string, unknown> = {}) {
  const job = await ctx.api.post(`/jobs/${id}/approve`, body);
  await ctx.reply(`✅ Job ${b(job.number)} approved.`);
  await showJob(ctx, id);
}

async function move(ctx: Ctx, id: number, word: string) {
  const target = MOVES[word.toLowerCase()];
  if (!target) throw new InputError(`Unknown step "${word}". Use start, done, review, close or rework.`);
  const [action, status] = target;
  const job = await ctx.api.post(`/jobs/${id}/${action}`, { status });
  await ctx.reply(`Job ${b(job.number)} is now ${b(label(job.status))}.`);
  await showJob(ctx, id);
}

export const jobCommands: Command[] = [
  {
    name: "jobs",
    group: "Job orders",
    summary: "Latest job orders: /jobs [status] [search]",
    usage: `<code>/jobs</code> — latest 10\n<code>/jobs in_progress</code> — by status (${STATUSES.join(", ")})\n<code>/jobs 014</code> — search by number`,
    async run(ctx) {
      const [first, rest] = splitFirst(ctx.args);
      const status = STATUSES.includes(first.toLowerCase()) ? first.toLowerCase() : undefined;
      const { data, total } = await ctx.api.get("/jobs", { status, q: status ? rest : ctx.args, pageSize: 10 });
      if (!data.length) return ctx.reply("No job orders found.");
      await ctx.reply(
        lines(
          b(`Job orders (${data.length} of ${total})`),
          ...data.map((j: any) => `• ${code(j.number)} ${esc(j.customer?.name ?? "")} — ${money(j.price)} · ${label(j.status)}${j.deadline ? ` · due ${day(j.deadline)}` : ""}`),
          "\nSend /job &lt;number&gt; for details.",
        ),
      );
    },
  },
  {
    name: "job",
    group: "Job orders",
    summary: "Show a job order with its workflow buttons: /job TAJO-001-26",
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      await showJob(ctx, (await findJob(ctx.api, ctx.args)).id);
    },
  },
  {
    name: "newjob",
    group: "Job orders",
    summary: "Create a job order (send /newjob to see the form)",
    usage: NEW_JOB,
    async run(ctx) {
      const form = parseForm(ctx.body);
      if (!form.rows.length && !form.fields.size) throw new UsageError();
      const proformaRef = opt(form.fields.get("proforma"));
      const proforma = proformaRef ? await findProforma(ctx.api, proformaRef) : undefined;
      const customer = proforma ? { customerId: proforma.customerId as number } : await customerFromForm(ctx.api, form);
      const items = proforma ? [] : (await linesFromRows(ctx.api, form.rows)).map(({ discount: _discount, ...l }) => l);
      const job = await ctx.api.post("/jobs", {
        ...customer,
        proformaNumber: proforma?.number,
        jobType: opt(form.fields.get("type")),
        description: opt(form.fields.get("description")),
        deadline: parseDate(form.fields.get("deadline"), "deadline"),
        priority: priority(form.fields.get("priority")),
        advancePayment: optionalAmount(form.fields.get("advance"), "advance"),
        adminNotes: opt(form.fields.get("notes")),
        jobItems: items,
      });
      await ctx.reply(`🧾 Job order ${b(job.number)} created (pending approval).`);
      await showJob(ctx, job.id);
    },
  },
  {
    name: "approvejob",
    group: "Job orders",
    summary: "Approve a job order (Admin), optionally setting price, deadline, priority",
    usage: `<code>/approvejob TAJO-001-26</code>\nor with changes:\n<pre>/approvejob TAJO-001-26
price: 30000
deadline: 2026-11-30
priority: high
advance: 10000
notes: Use the new vinyl</pre>`,
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      const job = await findJob(ctx.api, ctx.args);
      const { fields } = parseForm(ctx.body);
      await approve(ctx, job.id, {
        price: optionalAmount(fields.get("price"), "price"),
        deadline: parseDate(fields.get("deadline"), "deadline"),
        priority: priority(fields.get("priority")),
        advancePayment: optionalAmount(fields.get("advance"), "advance"),
        adminNotes: opt(fields.get("notes")),
      });
    },
  },
  {
    name: "jobstatus",
    group: "Job orders",
    summary: "Move a job: /jobstatus TAJO-001-26 start|done|review|close|rework",
    usage: `<code>/jobstatus TAJO-001-26 start</code> — production started (Production, Admin)
<code>/jobstatus TAJO-001-26 done</code> — production completed (Production, Admin)
<code>/jobstatus TAJO-001-26 review</code> — finance review (Finance, Admin)
<code>/jobstatus TAJO-001-26 close</code> — close the job (Finance, Admin)
<code>/jobstatus TAJO-001-26 rework</code> — send back from finance review (Finance, Admin)`,
    async run(ctx) {
      const [ref, word] = splitFirst(ctx.args);
      if (!ref || !word) throw new UsageError();
      await move(ctx, (await findJob(ctx.api, ref)).id, word);
    },
  },
];

export const jobActions: Action[] = [
  { prefix: "ja", run: (ctx, [id]) => approve(ctx, Number(id)) },
  { prefix: "jm", run: (ctx, [id, word]) => move(ctx, Number(id), word) },
];
