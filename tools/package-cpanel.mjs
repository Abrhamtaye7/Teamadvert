// Lays out exactly what to upload to Yegara cPanel (see docs/SETUP.md):
//   dist/cpanel/teamadvert-api/  → ~/teamadvert-api/   (Node.js App root)
//   dist/cpanel/public_html/     → ~/public_html/      (public site + /office)
// Run via `npm run package:cpanel`, which builds everything first.
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "cpanel");
const api = path.join(out, "teamadvert-api");

const required = ["dist/site/index.html", "dist/site/office/index.html", "apps/api/dist/server.mjs", "apps/api/dist/db-cli.mjs", "apps/api/dist/backup-cli.mjs"];
for (const file of required) {
  if (!existsSync(path.join(root, file))) {
    console.error(`Missing ${file}. Run the builds first (npm run package:cpanel does this).`);
    process.exit(1);
  }
}

rmSync(out, { recursive: true, force: true });
cpSync(path.join(root, "dist", "site"), path.join(out, "public_html"), { recursive: true });
cpSync(path.join(root, "apps", "api", "app.cjs"), path.join(api, "app.cjs"));
cpSync(path.join(root, "apps", "api", "dist"), path.join(api, "dist"), { recursive: true });
cpSync(path.join(root, "packages", "db", "migrations"), path.join(api, "migrations"), { recursive: true });
console.log(`cPanel upload ready in ${path.relative(root, out)}/ (public_html/ and teamadvert-api/)`);
