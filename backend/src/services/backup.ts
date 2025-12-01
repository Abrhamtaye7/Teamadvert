import fs from "fs";
import path from "path";
import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { config } from "../config/env";
import { log } from "../utils/logger";

function ensureDir() {
  if (!fs.existsSync(config.backupDir)) {
    fs.mkdirSync(config.backupDir, { recursive: true });
  }
}

export async function runBackupOnce() {
  ensureDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(config.backupDir, `backup-${timestamp}.json`);
  try {
    const summary = {
      generatedAt: new Date().toISOString(),
      tables: {
        customers: await prisma.customer.count(),
        suppliers: await prisma.supplier.count(),
        items: await prisma.item.count(),
        proformas: await prisma.proforma.count(),
        jobs: await prisma.jobOrder.count(),
        payments: await prisma.payment.count(),
      },
    };
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), "utf-8");
    await prisma.backup.create({ data: { path: filePath, status: "ok" } });
    log.info(`Backup created at ${filePath}`);
  } catch (error) {
    log.error("Backup failed", error);
    await prisma.backup.create({ data: { path: filePath, status: "failed" } });
  }
}

export function scheduleBackups() {
  // Weekly Sunday at 02:00
  cron.schedule("0 2 * * 0", () => runBackupOnce());
}
