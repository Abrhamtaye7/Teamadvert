import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Loads the nearest .env found by walking up from the current directory (so it works from any workspace
 * and from the bundled server). Variables already set in the environment win. On cPanel, variables come
 * from the Node.js App settings and no .env is needed.
 */
export function loadRootEnv(from = process.cwd()) {
  let dir = path.resolve(from);
  for (let i = 0; i < 5; i++) {
    const file = path.join(dir, ".env");
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return file;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}
