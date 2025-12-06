"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const backup_1 = require("../services/backup");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get("/", (0, auth_1.requireRole)(["Admin"]), async (_req, res) => {
    const backups = await prisma_1.prisma.backup.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    res.json(backups);
});
router.post("/run", (0, auth_1.requireRole)(["Admin"]), async (_req, res) => {
    await (0, backup_1.runBackupOnce)();
    res.json({ message: "Backup triggered" });
});
router.post("/:id/restore", (0, auth_1.requireRole)(["Admin"]), async (req, res) => {
    const id = Number(req.params.id);
    const backup = await prisma_1.prisma.backup.findUnique({ where: { id } });
    if (!backup)
        return res.status(404).json({ message: "Backup not found" });
    // Placeholder for restore logic; wired for PRD flow traceability
    res.json({ message: "Restore simulated (implement DB import here)", path: backup.path });
});
exports.default = router;
