import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // PRD: auto logout after inactivity
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(120),
  SESSION_MAX_HOURS: z.coerce.number().int().positive().default(12),
  // Local preview only: serve the built web + office sites from this folder. On cPanel, Apache serves them.
  SITE_DIR: z.string().optional(),
});

export type Config = {
  databaseUrl: string;
  env: "development" | "production" | "test";
  port: number;
  sessionIdleMinutes: number;
  sessionMaxHours: number;
  cookieSecure: boolean;
  siteDir?: string;
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
  };
}
