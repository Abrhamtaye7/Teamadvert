// The bot: checks who is writing, acts as their linked office user and runs the command or button they sent.
// Stateless: every message carries everything it needs, so it works on cPanel without a background process.
import { eq, sql } from "drizzle-orm";
import { roles, users, type Db } from "@teamadvert/db";
import type { Config, TelegramConfig } from "../config";
import { createSession } from "../lib/sessions";
import { type Keyboard, type TelegramClient, TelegramError, type TgUpdate } from "./client";
import { ACTIONS, COMMANDS } from "./commands";
import { type Command, type Ctx, type OfficeUser, UsageError } from "./context";
import { b, esc, fit, lines } from "./format";
import { InputError } from "./forms";
import { type CallApi, createOfficeApi, OfficeError } from "./office";

export type Bot = { handleUpdate(update: TgUpdate): Promise<void> };

const COMMAND_LINE = /^\/([A-Za-z0-9_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/;

/** What went wrong, in words the user can act on. */
function errorReply(err: unknown, user: OfficeUser, command?: Command) {
  if (err instanceof UsageError && command) {
    return lines(`How to use ${b(`/${command.name}`)}:`, command.usage ?? esc(command.summary));
  }
  if (err instanceof InputError) return `⚠️ ${esc(err.message)}`;
  if (err instanceof OfficeError) {
    if (err.status === 403) return `⛔ Your office role (${esc(user.role)}) can't do that.`;
    if (err.status < 500) return `⚠️ ${esc(err.message)}`;
  }
  return "😕 Something went wrong in the office system. Please try again, or use the office website.";
}

export function createBot({
  db,
  config,
  telegram,
  callApi,
}: {
  db: Db;
  config: Config & { telegram: TelegramConfig };
  telegram: TelegramClient;
  callApi: CallApi;
}): Bot {
  const officeUrl = `${config.publicUrl}/office`;
  const policy = { idleMinutes: config.sessionIdleMinutes, maxHours: config.sessionMaxHours };
  /** Office user id → session token. Lost on restart; a new session is then created on demand. */
  const tokens = new Map<number, string>();
  /** Telegram resends an update when the answer is slow; never run one twice. */
  const seen = new Set<number>();

  async function officeUser(username: string): Promise<OfficeUser | undefined> {
    const [row] = await db
      .select({ id: users.id, username: users.username, role: roles.name, isActive: users.isActive })
      .from(users)
      .innerJoin(roles, eq(roles.id, users.roleId))
      .where(eq(sql`lower(${users.username})`, username.toLowerCase()));
    return row?.isActive ? { id: row.id, username: row.username, role: row.role } : undefined;
  }

  async function session(user: OfficeUser, renew: boolean) {
    const existing = tokens.get(user.id);
    if (existing && !renew) return existing;
    const token = await createSession(db, user.id, policy, { userAgent: "Team Advert Telegram bot" });
    tokens.set(user.id, token);
    return token;
  }

  async function send(chatId: number, text: string, keyboard?: Keyboard) {
    await telegram.call("sendMessage", {
      chat_id: chatId,
      text: fit(text),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(keyboard?.length ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
  }

  return {
    async handleUpdate(update) {
      if (seen.has(update.update_id)) return;
      seen.add(update.update_id);
      if (seen.size > 500) seen.delete(seen.values().next().value as number);

      const message = update.message;
      const callback = update.callback_query;
      const from = message?.from ?? callback?.from;
      const chat = message?.chat ?? callback?.message?.chat;
      // Office data is never shown in groups or channels, even to a linked user
      if (!from || !chat || chat.type !== "private") return;
      if (callback) await telegram.call("answerCallbackQuery", { callback_query_id: callback.id }).catch(() => undefined);

      const username = config.telegram.users.get(from.id);
      if (!username) {
        await send(chat.id, `This is Team Advert's private office bot.\nYour Telegram ID is <code>${from.id}</code>.`);
        return;
      }
      const user = await officeUser(username);
      if (!user) {
        await send(chat.id, `⛔ Your Telegram account is linked to office user ${b(username)}, which doesn't exist or is disabled.`);
        return;
      }

      let command: Command | undefined;
      const ctx: Ctx = {
        api: createOfficeApi(callApi, (renew) => session(user, renew)),
        user,
        officeUrl,
        args: "",
        body: [],
        reply: (text, keyboard) => send(chat.id, text, keyboard),
        forget: async () => {
          if (message) await telegram.call("deleteMessage", { chat_id: chat.id, message_id: message.message_id }).catch(() => undefined);
        },
      };

      try {
        if (callback) {
          const [prefix, ...params] = (callback.data ?? "").split(":");
          const action = ACTIONS.find((a) => a.prefix === prefix);
          if (action) await action.run(ctx, params);
          return;
        }
        const text = message?.text?.trim() ?? "";
        const [firstLine, ...body] = text.split("\n");
        const match = COMMAND_LINE.exec(firstLine.trim());
        if (!match) {
          await ctx.reply("Send /help to see what I can do.");
          return;
        }
        command = COMMANDS.find((c) => c.name === match[1].toLowerCase());
        if (!command) {
          await ctx.reply(`Unknown command /${esc(match[1])}. Send /help for the list.`);
          return;
        }
        await command.run({ ...ctx, args: (match[2] ?? "").trim(), body });
      } catch (err) {
        const expected = err instanceof UsageError || err instanceof InputError || (err instanceof OfficeError && err.status < 500);
        if (!expected) console.error(`Telegram bot: ${command ? `/${command.name}` : (callback?.data ?? "update")} failed:`, err);
        await ctx.reply(errorReply(err, user, command)).catch((sendErr: unknown) => {
          if (sendErr instanceof TelegramError) console.error("Telegram bot: could not send the error reply:", sendErr.message);
        });
      }
    },
  };
}
