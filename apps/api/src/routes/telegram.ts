import { createHash, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import type { Bot } from "../telegram/bot";
import type { TgUpdate } from "../telegram/client";
import type { AppEnv } from "../types";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Telegram calls POST /api/telegram/webhook for every message and button press, sending back the secret given
 * to setWebhook in a header. Requests without it look like any unknown URL.
 */
export function telegramRoutes(bot: Bot, secret: string) {
  return new Hono<AppEnv>().post("/webhook", async (c) => {
    const given = c.req.header("X-Telegram-Bot-Api-Secret-Token") ?? "";
    if (!timingSafeEqual(digest(given), digest(secret))) return c.json({ message: "Not found" }, 404);

    const update = (await c.req.json().catch(() => null)) as TgUpdate | null;
    if (update && typeof update.update_id === "number") {
      try {
        await bot.handleUpdate(update);
      } catch (err) {
        console.error("Telegram webhook failed:", err);
      }
    }
    // Always 200: on an error Telegram would resend the update and repeat the action (e.g. a payment)
    return c.json({ ok: true });
  });
}
