import type { Db } from "@teamadvert/db";
import type { Config } from "./config";
import type { CbeVerifier } from "./lib/cbe";
import type { FixedWindowLimiter } from "./lib/rateLimit";
import type { AuthUser } from "./lib/sessions";

export type Deps = {
  db: Db;
  config: Config;
  loginLimiter: FixedWindowLimiter;
  /** Website quote form: per-IP limit */
  quoteLimiter: FixedWindowLimiter;
  /** Public proforma QR checks: per-IP limit */
  verifyLimiter: FixedWindowLimiter;
  cbeVerifier: CbeVerifier;
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
