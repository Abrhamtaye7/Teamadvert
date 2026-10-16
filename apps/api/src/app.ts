import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { ApiError } from "./lib/errors";
import { authRoutes } from "./routes/auth";
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
    c.header("X-Robots-Tag", "noindex, nofollow");
    c.header("Cache-Control", "no-store");
    await next();
  });

  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/auth", authRoutes);
  app.route("/users", userRoutes);

  app.notFound((c) => c.json({ message: "Not found" }, 404));
  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ message: err.message, ...err.extra }, err.status);
    console.error(`${c.req.method} ${c.req.path} failed:`, err);
    return c.json({ message: "Internal server error" }, 500);
  });

  return app;
}
