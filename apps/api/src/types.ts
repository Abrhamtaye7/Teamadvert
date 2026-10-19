import type { Db } from "@teamadvert/db";
import type { Config } from "./config";
import type { CbeVerifier } from "./lib/cbe";
import type { FixedWindowLimiter } from "./lib/rateLimit";
import type { AuthUser } from "./lib/sessions";
import type { TelegramClient } from "./telegram/client";

export type Deps = {
  db: Db;
  config: Config;
  loginLimiter: FixedWindowLimiter;
  /** Website quote form: per-IP limit */
  quoteLimiter: FixedWindowLimiter;
  /** Public proforma QR checks: per-IP limit */
  verifyLimiter: FixedWindowLimiter;
  cbeVerifier: CbeVerifier;
  /** Sends the Telegram bot's replies; the bot is on when this and config.telegram are set */
  telegram?: TelegramClient;
};

export type AppEnv = {
  Variables: Deps & {
    user: AuthUser;
    sessionId: string;
  };
};

export const ROLES = {
  Admin: "Admin",
  Finance: "Finance",
  Sales: "Sales",
  Designer: "Designer",
  Production: "Production",
} as const;
