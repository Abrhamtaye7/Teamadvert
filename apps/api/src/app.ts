import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { ApiError } from "./lib/errors";
import { authRoutes } from "./routes/auth";
import { backupRoutes } from "./routes/backups";
import { customerRoutes } from "./routes/customers";
import { itemRoutes } from "./routes/items";
import { jobRoutes } from "./routes/jobs";
import { leadRoutes, publicRoutes } from "./routes/leads";
import { notificationRoutes } from "./routes/notifications";
import { paymentRoutes } from "./routes/payments";
import { proformaRoutes } from "./routes/proformas";
import { reportRoutes } from "./routes/reports";
import { searchRoutes } from "./routes/search";
import { supplierRoutes } from "./routes/suppliers";
import { userRoutes } from "./routes/users";
import type { AppEnv, Deps } from "./types";

/** The API, mounted at /api. Dependencies are injected so tests can use a test database. */
export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>().basePath("/api");

  app.use(secureHeaders());
  app.use(async (c, next) => {
    c.set("db", deps.db);
    c.set("config", deps.config);
    c.set("loginLimiter", deps.loginLimiter);
    c.set("quoteLimiter", deps.quoteLimiter);
    c.set("cbeVerifier", deps.cbeVerifier);
    c.header("X-Robots-Tag", "noindex, nofollow");
    c.header("Cache-Control", "no-store");
    await next();
  });

  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/auth", authRoutes);
  app.route("/users", userRoutes);
  app.route("/customers", customerRoutes);
  app.route("/suppliers", supplierRoutes);
  app.route("/items", itemRoutes);
  app.route("/proformas", proformaRoutes);
  app.route("/jobs", jobRoutes);
  app.route("/payments", paymentRoutes);
  app.route("/reports", reportRoutes);
  app.route("/search", searchRoutes);
  app.route("/notifications", notificationRoutes);
  app.route("/backups", backupRoutes);
  app.route("/public", publicRoutes);
  app.route("/leads", leadRoutes);

  app.notFound((c) => c.json({ message: "Not found" }, 404));
  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ message: err.message, ...err.extra }, err.status);
    // Drizzle wraps driver errors; map common PostgreSQL constraint violations to client errors
    const code = (err as { cause?: { code?: string } }).cause?.code ?? (err as { code?: string }).code;
    if (code === "23503") return c.json({ message: "A referenced record does not exist" }, 400);
    if (code === "23505") return c.json({ message: "That record already exists" }, 409);
    console.error(`${c.req.method} ${c.req.path} failed:`, err);
    return c.json({ message: "Internal server error" }, 500);
  });

  return app;
}
