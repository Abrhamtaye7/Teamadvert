"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const app_1 = __importDefault(require("./app"));
const backup_1 = require("./services/backup");
const logger_1 = require("./utils/logger");
const server = app_1.default.listen(env_1.config.port, () => {
    logger_1.log.info(`API running on port ${env_1.config.port}`);
});
(0, backup_1.scheduleBackups)();
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
