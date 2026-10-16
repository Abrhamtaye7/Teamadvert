// Combines the public site and the office app into one static-assets folder
// served by the API Worker: web build at "/", office build at "/office".
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist", "site");
const webDist = path.join(root, "apps", "web", "dist");
const officeDist = path.join(root, "apps", "office", "dist");

for (const dir of [webDist, officeDist]) {
  if (!existsSync(dir)) {
    console.error(`Missing build output: ${path.relative(root, dir)}. Run the app builds first.`);
    process.exit(1);
  }
}

rmSync(out, { recursive: true, force: true });
cpSync(webDist, out, { recursive: true });
cpSync(officeDist, path.join(out, "office"), { recursive: true });
console.log(`Assembled site at ${path.relative(root, out)}`);
