// Weekly backup for cPanel → Cron Jobs (built to dist/backup-cli.mjs), e.g. Sundays 02:00:
//   0 2 * * 0  cd ~/teamadvert-api && /path/to/node dist/backup-cli.mjs
import { createDb, loadRootEnv } from "@teamadvert/db";
import { loadConfig } from "./config";
import { runBackup } from "./lib/backup";

loadRootEnv();
const config = loadConfig();
const { db, pool } = createDb(config.databaseUrl, { connectionLimit: 1 });
try {
  const row = await runBackup(db, config.backupDir);
  console.log(`Backup ${row.status}: ${row.path}`);
  process.exitCode = row.status === "ok" ? 0 : 1;
} finally {
  await pool.end();
}
