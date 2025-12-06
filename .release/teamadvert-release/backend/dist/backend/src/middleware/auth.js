"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
exports.requireAuth = requireAuth;
const jwt_1 = require("../utils/jwt");
const prisma_1 = require("../lib/prisma");
async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header)
            return res.status(401).json({ message: "Missing token" });
        const [, token] = header.split(" ");
        const payload = (0, jwt_1.verifyToken)(token);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: Number(payload.sub) || 0 },
            include: { role: true },
        });
        if (!user)
            return res.status(401).json({ message: "Invalid token" });
        req.user = { id: user.id, role: user.role.name, permissions: user.role.permissions ?? {} };
        next();
    }
    catch (err) {
        return res.status(401).json({ message: "Unauthorized" });
    }
}
const requireRole = (allowed) => {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        if (!allowed.includes(req.user.role))
            return res.status(403).json({ message: "Forbidden" });
        next();
    };
};
exports.requireRole = requireRole;
