// Fails if the public website still contains placeholder text ("TODO: …") in apps/web/src/content/site.ts.
// Run automatically by `npm run package:cpanel`, so placeholders can't be deployed by accident.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "apps/web/src/content/site.ts");
const lines = readFileSync(file, "utf8").split("\n");
const todos = lines.map((line, i) => ({ line: i + 1, text: line.trim() })).filter((l) => !l.text.startsWith("//") && /(^|:)\s*["'`]TODO:/.test(l.text));

if (todos.length) {
  console.error(`Website content still has ${todos.length} placeholder(s) in ${path.relative(root, file)}:`);
  for (const t of todos) console.error(`  line ${t.line}: ${t.text}`);
  console.error("Replace them with real company details before deploying.");
  process.exit(1);
}
console.log("Website content: no placeholders left.");
