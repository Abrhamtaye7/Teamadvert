import { type Action, type Command, type Ctx, UsageError } from "../context";
import { b, code, day, esc, label, lines, money } from "../format";

/** "nr:1,2,3" with as many whole ids as fit in Telegram's 64-byte callback_data. */
function markReadData(ids: number[]) {
  let data = "nr:";
  for (const id of ids) {
    const next = `${data}${data.length > 3 ? "," : ""}${id}`;
    if (next.length > 64) break;
    data = next;
  }
  return data;
}

async function showNotifications(ctx: Ctx, all: boolean) {
  const rows = await ctx.api.get<any[]>("/notifications");
  const shown = (all ? rows : rows.filter((n) => !n.read)).slice(0, 10);
  if (!shown.length) return ctx.reply(all ? "No notifications." : "No unread notifications. 🎉 (/notifications all shows read ones too)");
  const unread = shown.filter((n) => !n.read).map((n) => n.id as number);
  await ctx.reply(
    lines(b(all ? "Notifications" : "Unread notifications"), ...shown.map((n) => `${n.read ? "▫️" : "🔔"} ${esc(n.message)} · ${day(n.createdAt)}`)),
    unread.length ? [[{ text: "✔️ Mark these read", callback_data: markReadData(unread) }]] : undefined,
  );
}

export const generalCommands: Command[] = [
  {
    name: "me",
    group: "General",
    summary: "Your linked office account and what it may do",
    async run(ctx) {
      const me = await ctx.api.get("/auth/me");
      await ctx.reply(
        lines(
          `You are ${b(me.username)} (${esc(me.role)}) in the office.`,
          `Access: ${esc((me.access ?? []).join(", ") || "none")}`,
          me.lastLoginAt ? `Last office login: ${day(me.lastLoginAt)}` : "",
        ),
      );
    },
  },
  {
    name: "dashboard",
    group: "General",
    summary: "This month at a glance: jobs, money collected, what is waiting",
    async run(ctx) {
      const [{ summary }, drafts, pending, completed, unread] = await Promise.all([
        ctx.api.get("/reports/overview", { months: 1 }),
        ctx.api.get("/proformas", { status: "draft", pageSize: 1 }),
        ctx.api.get("/jobs", { status: "pending_approval", pageSize: 1 }),
        ctx.api.get("/jobs", { status: "completed", pageSize: 1 }),
        ctx.api.get<any[]>("/notifications"),
      ]);
      await ctx.reply(
        lines(
          b("📊 Dashboard"),
          `Jobs this month: ${b(summary.jobsThisMonth)}`,
          `Collected this month: ${b(money(summary.collectedThisMonth))}`,
          `Outstanding (open jobs): ${b(money(summary.outstandingTotal))}`,
          `Open jobs: ${b(summary.pendingJobs)}`,
          "",
          b("Waiting"),
          `• Draft proformas: ${drafts.total} → /proformas draft`,
          `• Jobs to approve: ${pending.total} → /jobs pending_approval`,
          `• Completed jobs for finance: ${completed.total} → /jobs completed`,
          `• Unread notifications: ${unread.filter((n) => !n.read).length} → /notifications`,
        ),
      );
    },
  },
  {
    name: "report",
    group: "General",
    summary: "Monthly report: /report [months, 1–12]",
    async run(ctx) {
      const months = ctx.args ? Number(ctx.args) : 6;
      if (!Number.isInteger(months) || months < 1 || months > 12) throw new UsageError();
      const { summary, chart } = await ctx.api.get("/reports/overview", { months });
      await ctx.reply(
        lines(
          b(`📈 Last ${months} month(s)`),
          ...chart.map((m: any) => `${code(m.month)} ${m.jobs} jobs · collected ${money(m.collected)} · outstanding ${money(m.outstanding)}`),
          "",
          `Outstanding on open jobs: ${b(money(summary.outstandingTotal))}`,
          `Finance-approved payments (all time): ${b(money(summary.financeApprovedTotal))}`,
        ),
      );
    },
  },
  {
    name: "search",
    group: "General",
    summary: "Search everything: /search sunrise",
    async run(ctx) {
      if (!ctx.args) throw new UsageError();
      const r = await ctx.api.get("/search", { q: ctx.args });
      const section = (title: string, rows: any[] | undefined, show: (row: any) => string) => (rows?.length ? `${b(title)}\n${rows.map(show).join("\n")}` : "");
      const text = lines(
        section("Customers", r.customers, (c) => `• ${code(c.customerId)} ${esc(c.name)}`),
        section("Proformas", r.proformas, (p) => `• ${code(p.number)} ${label(p.status)}`),
        section("Jobs", r.jobs, (j) => `• ${code(j.number)} ${label(j.status)}`),
        section("Payments", r.payments, (p) => `• #${p.id} ${money(p.amount)} ${code(p.transactionNumber)}`),
        section("Suppliers", r.suppliers, (s) => `• ${code(s.supplierId)} ${esc(s.companyName)}`),
        section("Items", r.items, (i) => `• ${code(i.itemId)} ${esc(i.name)}`),
      );
      await ctx.reply(text || `Nothing matches "${esc(ctx.args)}".`);
    },
  },
  {
    name: "notifications",
    group: "General",
    summary: "Unread notifications (/notifications all for every recent one)",
    async run(ctx) {
      await showNotifications(ctx, ctx.args.toLowerCase() === "all");
    },
  },
];

export const generalActions: Action[] = [
  {
    prefix: "nr",
    async run(ctx, [ids]) {
      const list = ids.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0);
      // Some may have been marked read in the office meanwhile; that is fine
      await Promise.all(list.map((id) => ctx.api.post(`/notifications/${id}/read`).catch(() => undefined)));
      await ctx.reply(`✔️ Marked ${list.length} notification(s) read.`);
    },
  },
];
