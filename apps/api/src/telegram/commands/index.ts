import type { Action, Command } from "../context";
import { b, code, esc, lines } from "../format";
import { adminCommands } from "./admin";
import { customerCommands } from "./customers";
import { financeActions, financeCommands } from "./finance";
import { generalActions, generalCommands } from "./general";
import { itemCommands } from "./items";
import { jobActions, jobCommands } from "./jobs";
import { leadActions, leadCommands } from "./leads";
import { proformaActions, proformaCommands } from "./proformas";
import { supplierCommands } from "./suppliers";

const start: Command = {
  name: "start",
  group: "General",
  summary: "Welcome and quick start",
  async run(ctx) {
    await ctx.reply(
      lines(
        `👋 Hello ${b(ctx.user.username)} (${esc(ctx.user.role)}). This bot does what the office app does, with commands.`,
        "",
        "Try:",
        "/dashboard — what is waiting today",
        "/proformas, /jobs, /payments — latest records",
        "/newproforma — create a proforma (send it alone to see the form)",
        "/search &lt;text&gt; — find anything",
        "",
        "/help lists every command; /help &lt;command&gt; explains one.",
      ),
    );
  },
};

const help: Command = {
  name: "help",
  group: "General",
  summary: "All commands, or how to use one: /help newjob",
  async run(ctx) {
    const wanted = ctx.args.replace(/^\//, "").toLowerCase();
    if (wanted) {
      const command = COMMANDS.find((c) => c.name === wanted);
      if (!command) return ctx.reply(`No command /${esc(wanted)}. Send /help for the list.`);
      return ctx.reply(lines(`${b(`/${command.name}`)} — ${esc(command.summary)}`, command.usage ? `\n${command.usage}` : ""));
    }
    const groups = [...new Set(COMMANDS.map((c) => c.group))];
    await ctx.reply(
      lines(
        ...groups.map((group) => `\n${b(group)}\n${COMMANDS.filter((c) => c.group === group).map((c) => `/${c.name} — ${esc(c.summary)}`).join("\n")}`),
        `\nSend ${code("/help newproforma")} (or any command) for the details and an example.`,
      ),
    );
  },
};

export const COMMANDS: Command[] = [
  start,
  help,
  ...generalCommands,
  ...proformaCommands,
  ...jobCommands,
  ...financeCommands,
  ...leadCommands,
  ...customerCommands,
  ...supplierCommands,
  ...itemCommands,
  ...adminCommands,
];

export const ACTIONS: Action[] = [...generalActions, ...proformaActions, ...jobActions, ...financeActions, ...leadActions];
