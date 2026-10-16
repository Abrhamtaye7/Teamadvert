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
});

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
  };
}
