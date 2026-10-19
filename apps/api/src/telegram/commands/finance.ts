import { type Action, type Command, type Ctx, UsageError } from "../context";
import { b, code, day, esc, lines, money } from "../format";
import { InputError, parseAmount } from "../forms";
import { findJob } from "../lookup";
import { showJob } from "./jobs";

/** Checks a bank payment with CBE using its own transaction number and amount. */
async function verify(ctx: Ctx, paymentId: number) {
  const payments = await ctx.api.get<any[]>("/payments");
  const payment = payments.find((p) => p.id === paymentId);
  if (!payment) throw new InputError(`Payment #${paymentId} is not among the latest 100 payments.`);
  if (!payment.transactionNumber) throw new InputError(`Payment #${paymentId} has no transaction number to check.`);
  const result = await ctx.api.post(`/payments/${paymentId}/verify`, { transactionNumber: payment.transactionNumber, expectedAmount: Number(payment.amount) });
  await ctx.reply(
    result.success
      ? `🏦 CBE confirmed payment #${paymentId} (${code(payment.transactionNumber)}, ${money(payment.amount)}).`
      : lines(`⚠️ CBE could not confirm payment #${paymentId} (${code(payment.transactionNumber)}).`, ...(result.issues ?? []).map((i: string) => `• ${esc(i)}`)),
  );
}

export const financeCommands: Command[] = [
  {
    name: "payments",
    group: "Finance",
    summary: "Latest payments, or one job's: /payments [job number]",
    async run(ctx) {
      if (ctx.args) return showJob(ctx, (await findJob(ctx.api, ctx.args)).id);
      const rows = (await ctx.api.get<any[]>("/payments")).slice(0, 15);
      if (!rows.length) return ctx.reply("No payments yet.");
      await ctx.reply(
        lines(
          b("Latest payments"),
          ...rows.map(
            (p) =>
              `• #${p.id} ${money(p.amount)} ${esc(p.method)} — ${code(p.jobOrder?.number ?? "?")}${p.transactionNumber ? ` ${code(p.transactionNumber)}` : ""} · ${p.verified ? "verified" : "not verified"} · ${day(p.createdAt)}`,
          ),
          "\nVerify a bank payment with /verify &lt;payment #&gt;.",
        ),
      );
    },
  },
  {
    name: "pay",
    group: "Finance",
    summary: "Record a payment (Finance, Admin): /pay TAJO-001-26 5000 cash | bank FT123…",
    usage: `<code>/pay TAJO-001-26 5000 cash</code>
<code>/pay TAJO-001-26 12,500 bank FT26292XXXXX</code> — bank transfers need the CBE transaction number

A full cash payment on a completed job closes it; a full bank payment sends it to finance review until CBE confirms it.`,
    async run(ctx) {
      const [ref, amount, method, transactionNumber] = ctx.args.split(/\s+/);
      if (!ref || !amount || !method) throw new UsageError();
      const kind = method.toLowerCase();
      if (kind !== "cash" && kind !== "bank") throw new InputError("Method must be cash or bank.");
      if (kind === "bank" && !transactionNumber) throw new InputError("Bank payments need the transaction number after \"bank\".");
      const job = await findJob(ctx.api, ref);
      const payment = await ctx.api.post("/payments", {
        jobId: job.id,
        amount: parseAmount(amount, "Amount"),
        method: kind === "cash" ? "Cash" : "Bank",
        transactionNumber,
      });
      await ctx.reply(`💰 Payment #${payment.id} of ${b(money(payment.amount))} recorded on ${b(job.number)}.`);
      await showJob(ctx, job.id);
    },
  },
  {
    name: "verify",
    group: "Finance",
    summary: "Check a bank payment with CBE (Finance, Admin): /verify 12",
    async run(ctx) {
      const id = Number(ctx.args.replace("#", ""));
      if (!Number.isInteger(id) || id <= 0) throw new UsageError();
      await verify(ctx, id);
    },
  },
];

export const financeActions: Action[] = [{ prefix: "pv", run: (ctx, [id]) => verify(ctx, Number(id)) }];
