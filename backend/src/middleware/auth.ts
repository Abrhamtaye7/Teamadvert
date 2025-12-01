import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt";
import { prisma } from "../lib/prisma";

export interface AuthUser {
  id: number;
  role: string;
  permissions?: Record<string, boolean> | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: "Missing token" });
    const [, token] = header.split(" ");
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) || 0 },
      include: { role: true },
    });
    if (!user) return res.status(401).json({ message: "Invalid token" });
    req.user = { id: user.id, role: user.role.name, permissions: (user.role.permissions as Record<string, boolean>) ?? {} };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

export const requireRole = (allowed: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!allowed.includes(req.user.role)) return res.status(403).json({ message: "Forbidden" });
    next();
  };
};
