import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt";
import { loginLimiter } from "../middleware/rateLimit";
import { recordAudit } from "../services/audit";
import { ensureSeedData } from "../services/bootstrap";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { log } from "../utils/logger";
import { userLoginSchema } from "../../../shared/schemas";

const router = Router();

router.post("/bootstrap", async (_req, res) => {
  await ensureSeedData();
  res.json({ message: "Seed completed" });
});

router.post("/login", loginLimiter, async (req, res) => {
  const parsed = userLoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid credentials" });
  const { username, pin } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username }, include: { role: true } });
  if (!user) return res.status(401).json({ message: "Invalid username or PIN" });
  const match = await bcrypt.compare(pin, user.pinHash);
  if (!match) return res.status(401).json({ message: "Invalid username or PIN" });

  const accessToken = signAccessToken({ sub: String(user.id), role: user.role.name });
  const refreshToken = signRefreshToken({ sub: String(user.id), role: user.role.name });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await prisma.loginLog.create({ data: { userId: user.id, ip: req.ip, userAgent: req.headers["user-agent"] || undefined } });
  await recordAudit({ userId: user.id, entity: "auth", action: "login" });

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role.name,
      permissions: user.role.permissions,
    },
  });
});

router.post("/refresh", async (req, res) => {
  const token = req.body?.refreshToken;
  if (!token) return res.status(400).json({ message: "Missing refresh token" });
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) }, include: { role: true } });
    if (!user) return res.status(401).json({ message: "Invalid token" });
    const accessToken = signAccessToken({ sub: String(user.id), role: user.role.name });
    res.json({ accessToken });
  } catch (error) {
    log.error("Refresh failed", error);
    res.status(401).json({ message: "Invalid token" });
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).end();
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { role: true } });
  res.json({
    id: user?.id,
    username: user?.username,
    role: user?.role.name,
    permissions: user?.role.permissions,
    lastLoginAt: user?.lastLoginAt,
  });
});

export default router;
