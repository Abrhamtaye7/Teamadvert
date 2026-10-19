import path from "node:path";
import { z } from "zod";
import { DEFAULT_CBE_CONFIG, type CbeConfig } from "./lib/cbe";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // PRD: auto logout after inactivity
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(120),
  SESSION_MAX_HOURS: z.coerce.number().int().positive().default(12),
  // Local preview only: serve the built web + office sites from this folder. On cPanel, Apache serves them.
  SITE_DIR: z.string().optional(),
  // Must be outside public_html: backups contain PIN hashes
  BACKUP_DIR: z.string().default("backups"),
  CBE_BASE_URL: z.string().url().default(DEFAULT_CBE_CONFIG.baseUrl),
  CBE_ACCOUNT_SUFFIX: z.string().default(DEFAULT_CBE_CONFIG.accountSuffix),
  // Where the site lives; used for links back to the office and for the Telegram webhook URL
  PUBLIC_URL: z.string().url().default("https://teamadvertplc.com"),
  // Telegram bot (optional): leave TELEGRAM_BOT_TOKEN empty to turn the bot off
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  // Telegram sends it back in a header on every webhook call
  TELEGRAM_WEBHOOK_SECRET: z
    .string()
    .regex(/^[A-Za-z0-9_-]{16,256}$/, "use 16–256 letters, digits, _ or -")
    .optional(),
  // Who may use the bot and which office account each one acts as: "telegramId:username,telegramId:username"
  TELEGRAM_USERS: z.string().optional(),
});

export type TelegramConfig = {
  token: string;
  webhookSecret: string;
  /** Telegram user id → office username */
  users: Map<number, string>;
};

/** "123:admin, 456:sara" → Map { 123 → "admin", 456 → "sara" } */
export function parseTelegramUsers(value: string): Map<number, string> {
  const users = new Map<number, string>();
  for (const entry of value.split(",").map((s) => s.trim()).filter(Boolean)) {
    const match = /^(\d{1,20}):(\S+)$/.exec(entry);
    if (!match) throw new Error(`Invalid environment: TELEGRAM_USERS entry "${entry}" should look like 123456789:username`);
    users.set(Number(match[1]), match[2]);
  }
  return users;
}

function telegramConfig(e: z.infer<typeof envSchema>): TelegramConfig | undefined {
  if (!e.TELEGRAM_BOT_TOKEN) return undefined;
  if (!e.TELEGRAM_WEBHOOK_SECRET) throw new Error("Invalid environment: TELEGRAM_WEBHOOK_SECRET is required when TELEGRAM_BOT_TOKEN is set");
  const users = parseTelegramUsers(e.TELEGRAM_USERS ?? "");
  if (!users.size) throw new Error("Invalid environment: TELEGRAM_USERS is required when TELEGRAM_BOT_TOKEN is set");
  return { token: e.TELEGRAM_BOT_TOKEN, webhookSecret: e.TELEGRAM_WEBHOOK_SECRET, users };
}

export type Config = {
  databaseUrl: string;
  env: "development" | "production" | "test";
  port: number;
  sessionIdleMinutes: number;
  sessionMaxHours: number;
  cookieSecure: boolean;
  siteDir?: string;
  backupDir: string;
  cbe: CbeConfig;
  /** No trailing slash, e.g. https://teamadvertplc.com */
  publicUrl: string;
  telegram?: TelegramConfig;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment (see .env.example): ${problems}`);
  }
  const e = parsed.data;
  return {
    databaseUrl: e.DATABASE_URL,
    env: e.NODE_ENV,
    port: e.PORT,
    sessionIdleMinutes: e.SESSION_IDLE_MINUTES,
    sessionMaxHours: e.SESSION_MAX_HOURS,
    cookieSecure: e.NODE_ENV === "production",
    siteDir: e.SITE_DIR,
    backupDir: path.resolve(e.BACKUP_DIR),
    cbe: { ...DEFAULT_CBE_CONFIG, baseUrl: e.CBE_BASE_URL, accountSuffix: e.CBE_ACCOUNT_SUFFIX },
    publicUrl: e.PUBLIC_URL.replace(/\/+$/, ""),
    telegram: telegramConfig(e),
  };
}
