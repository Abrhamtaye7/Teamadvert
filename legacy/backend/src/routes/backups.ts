import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { runBackupOnce } from "../services/backup";

const router = Router();
router.use(requireAuth);

router.get("/", requireRole(["Admin"]), async (_req, res) => {
  const backups = await prisma.backup.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  res.json(backups);
});

router.post("/run", requireRole(["Admin"]), async (_req, res) => {
  await runBackupOnce();
  res.json({ message: "Backup triggered" });
});

router.post("/:id/restore", requireRole(["Admin"]), async (req, res) => {
  const id = Number(req.params.id);
  const backup = await prisma.backup.findUnique({ where: { id } });
  if (!backup) return res.status(404).json({ message: "Backup not found" });
  // Placeholder for restore logic; wired for PRD flow traceability
  res.json({ message: "Restore simulated (implement DB import here)", path: backup.path });
});

export default router;
