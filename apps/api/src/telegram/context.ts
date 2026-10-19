import type { Keyboard } from "./client";
import type { OfficeApi } from "./office";

/** The office account a Telegram user acts as. */
export type OfficeUser = { id: number; username: string; role: string };

export type Ctx = {
  /** The office API, called as `user` */
  api: OfficeApi;
  user: OfficeUser;
  /** e.g. https://teamadvertplc.com/office */
  officeUrl: string;
  /** Text after the command on its first line */
  args: string;
  /** The message's other lines */
  body: string[];
  reply(text: string, keyboard?: Keyboard): Promise<void>;
  /** Deletes the user's message, for messages that contain a PIN */
  forget(): Promise<void>;
};

export type Command = {
  /** Without the slash; Telegram allows a-z, 0-9 and _ */
  name: string;
  group: string;
  /** One line for the command menu and /help */
  summary: string;
  /** How to use it (HTML), shown by /help <command> and when the input is wrong */
  usage?: string;
  run(ctx: Ctx): Promise<void>;
};

/** Handles a button press whose callback_data is "prefix:param:param". */
export type Action = { prefix: string; run(ctx: Ctx, params: string[]): Promise<void> };

/** Shows how to use a command: its usage text, or the summary when there is none. */
export class UsageError extends Error {}

export const hasRole = (ctx: Ctx, ...roles: string[]) => roles.includes(ctx.user.role);
