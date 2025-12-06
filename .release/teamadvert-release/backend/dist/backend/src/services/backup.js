"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBackupOnce = runBackupOnce;
exports.scheduleBackups = scheduleBackups;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = require("../lib/prisma");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
function ensureDir() {
    if (!fs_1.default.existsSync(env_1.config.backupDir)) {
        fs_1.default.mkdirSync(env_1.config.backupDir, { recursive: true });
    }
}
async function runBackupOnce() {
    ensureDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path_1.default.join(env_1.config.backupDir, `backup-${timestamp}.json`);
    try {
        const summary = {
            generatedAt: new Date().toISOString(),
            tables: {
                customers: await prisma_1.prisma.customer.count(),
                suppliers: await prisma_1.prisma.supplier.count(),
                items: await prisma_1.prisma.item.count(),
                proformas: await prisma_1.prisma.proforma.count(),
                jobs: await prisma_1.prisma.jobOrder.count(),
                payments: await prisma_1.prisma.payment.count(),
            },
        };
        fs_1.default.writeFileSync(filePath, JSON.stringify(summary, null, 2), "utf-8");
        await prisma_1.prisma.backup.create({ data: { path: filePath, status: "ok" } });
        logger_1.log.info(`Backup created at ${filePath}`);
    }
    catch (error) {
        logger_1.log.error("Backup failed", error);
        await prisma_1.prisma.backup.create({ data: { path: filePath, status: "failed" } });
    }
}
function scheduleBackups() {
    // Weekly Sunday at 02:00
    node_cron_1.default.schedule("0 2 * * 0", () => runBackupOnce());
}
