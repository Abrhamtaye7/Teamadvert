// Minimal Telegram Bot API client (https://core.telegram.org/bots/api). Plain fetch, no dependency.

type TgUser = { id: number; first_name?: string; username?: string };
type TgChat = { id: number; type: "private" | "group" | "supergroup" | "channel" };
type TgMessage = { message_id: number; chat: TgChat; from?: TgUser; text?: string; date: number };
type TgCallbackQuery = { id: string; from: TgUser; message?: TgMessage; data?: string };
export type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallbackQuery };

/** A button opens a URL or sends `callback_data` (max 64 bytes) back to the bot. */
export type InlineButton = { text: string; callback_data: string } | { text: string; url: string };
export type Keyboard = InlineButton[][];

export type TelegramClient = {
  call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
};

export class TelegramError extends Error {}

export function createTelegramClient(token: string, fetchImpl: typeof fetch = fetch): TelegramClient {
  return {
    async call<T>(method: string, params: Record<string, unknown> = {}) {
      const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
      // Never include the URL in errors: it contains the bot token
      if (!json?.ok) throw new TelegramError(`Telegram ${method} failed: ${json?.description ?? `HTTP ${res.status}`}`);
      return json.result as T;
    },
  };
}
