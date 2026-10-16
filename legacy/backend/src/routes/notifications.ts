import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const notifications = await prisma.notification.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications);
});

router.post("/:id/read", async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const notification = await prisma.notification.update({ where: { id }, data: { read: true } });
  res.json(notification);
});

export default router;
