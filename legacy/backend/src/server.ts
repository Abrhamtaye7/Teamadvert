import { config } from "./config/env";
import app from "./app";
import { scheduleBackups } from "./services/backup";
import { log } from "./utils/logger";

const server = app.listen(config.port, () => {
  log.info(`API running on port ${config.port}`);
});

scheduleBackups();

process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
