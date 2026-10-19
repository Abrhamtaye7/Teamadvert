// Telegram bot setup (built to dist/telegram-cli.mjs; locally `npm run telegram -- <command>`):
//   webhook    point Telegram at PUBLIC_URL/api/telegram/webhook and load the command menu (run once after deploying)
//   info       show the bot and its webhook status
//   unwebhook  stop Telegram calling the webhook
//   poll       local development: fetch messages from Telegram and pass them to the local API (http://localhost:PORT)
import { loadRootEnv } from "@teamadvert/db";
import { loadConfig } from "./config";
import { createTelegramClient, type TgUpdate } from "./telegram/client";
import { COMMANDS } from "./telegram/commands";

loadRootEnv();
const config = loadConfig();
const command = process.argv[2];
if (!config.telegram) {
  console.error("Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and TELEGRAM_USERS first (see docs/SETUP.md).");
  process.exit(2);
}
const { telegram: settings } = config;
const tg = createTelegramClient(settings.token);

/** The command menu, shown only in the linked users' chats (a stranger sees no commands). */
async function loadMenu() {
  const commands = COMMANDS.map((c) => ({ command: c.name, description: c.summary.slice(0, 256) }));
  await tg.call("deleteMyCommands", {});
  for (const [userId, username] of settings.users) {
    try {
      await tg.call("setMyCommands", { commands, scope: { type: "chat", chat_id: userId } });
      console.log(`Command menu (${commands.length} commands) set for ${userId} (${username}).`);
    } catch (err) {
      // "chat not found": that person hasn't pressed Start in the bot yet, or the ID is wrong
      console.error(`No command menu for ${userId} (${username}): ${describe(err)}. Have them press Start in the bot, then run this again.`);
    }
  }
}

async function info() {
  const me = await tg.call<{ username: string }>("getMe");
  const hook = await tg.call<{ url: string; pending_update_count: number; last_error_message?: string }>("getWebhookInfo");
  console.log(`Bot: @${me.username}`);
  console.log(`Webhook: ${hook.url || "(none)"}; pending updates: ${hook.pending_update_count}${hook.last_error_message ? `; last error: ${hook.last_error_message}` : ""}`);
  console.log(`Linked users: ${[...settings.users].map(([id, name]) => `${id} → ${name}`).join(", ")}`);
}

const describe = (err: unknown) =>
  err instanceof Error ? `${err.message}${(err.cause as { code?: string } | undefined)?.code ? ` (${(err.cause as { code: string }).code})` : ""}` : String(err);

/** Retries a network step: a dropped connection shouldn't stop the poller. */
async function retry<T>(what: string, step: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      return await step();
    } catch (err) {
      console.error(`${what} failed: ${describe(err)}; retrying in 5 s`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function poll() {
  const local = `http://localhost:${config.port}/api/telegram/webhook`;
  await retry("deleteWebhook", () => tg.call("deleteWebhook", {}));
  await retry("command menu", loadMenu);
  console.log(`Polling Telegram and forwarding to ${local} (Ctrl+C to stop). Run the API with the same .env.`);
  let offset = 0;
  for (;;) {
    try {
      const updates = await tg.call<TgUpdate[]>("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
      for (const update of updates) {
        offset = update.update_id + 1;
        const res = await fetch(local, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": settings.webhookSecret },
          body: JSON.stringify(update),
        });
        console.log(`update ${update.update_id} → ${res.status}`);
      }
    } catch (err) {
      console.error(describe(err));
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

try {
  if (command === "webhook") {
    const url = `${config.publicUrl}/api/telegram/webhook`;
    await tg.call("setWebhook", { url, secret_token: settings.webhookSecret, allowed_updates: ["message", "callback_query"], max_connections: 5 });
    console.log(`Webhook set to ${url}`);
    await loadMenu();
    await info();
  } else if (command === "unwebhook") {
    await tg.call("deleteWebhook", {});
    console.log("Webhook removed.");
  } else if (command === "info") {
    await info();
  } else if (command === "poll") {
    await poll();
  } else {
    console.error("Usage: node dist/telegram-cli.mjs <webhook|info|unwebhook|poll>");
    process.exitCode = 2;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
