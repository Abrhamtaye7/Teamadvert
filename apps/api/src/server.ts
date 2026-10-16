// Node entry point. Locally: `npm run dev:api`. On cPanel: the Node.js App startup file (built to dist/server.mjs).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createDb, loadRootEnv } from "@teamadvert/db";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createCbeVerifier } from "./lib/cbe";
import { FixedWindowLimiter } from "./lib/rateLimit";

loadRootEnv();
const config = loadConfig();
const { db, pool } = createDb(config.databaseUrl);

// Legacy limit: 20 login attempts per IP per 15 minutes (per-account lockout is separate)
const loginLimiter = new FixedWindowLimiter(20, 15 * 60_000);
// Website quote form: 5 requests per IP per hour
const quoteLimiter = new FixedWindowLimiter(5, 60 * 60_000);
const api = createApp({ db, config, loginLimiter, quoteLimiter, cbeVerifier: createCbeVerifier(config.cbe) });

const root = new Hono();
root.route("/", api);

if (config.siteDir) {
  // Local production preview: same layout as public_html on cPanel.
  const siteDir = config.siteDir;
  root.get("/office", (c) => c.redirect("/office/", 301));
  root.use("/*", serveStatic({ root: siteDir }));
  root.get("/office/*", serveStatic({ root: siteDir, path: "office/index.html" }));
  root.notFound(async (c) => {
    const page = await readFile(path.join(siteDir, "404.html"), "utf8").catch(() => "Not found");
    return c.html(page, 404);
  });
}

const server = serve({ fetch: root.fetch, port: config.port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/api (${config.env})`);
});

const shutdown = () => {
  server.close();
  void pool.end().finally(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
