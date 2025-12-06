"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
const jwt_1 = require("../utils/jwt");
const rateLimit_1 = require("../middleware/rateLimit");
const audit_1 = require("../services/audit");
const bootstrap_1 = require("../services/bootstrap");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const schemas_1 = require("../../../shared/schemas");
const router = (0, express_1.Router)();
router.post("/bootstrap", async (_req, res) => {
    await (0, bootstrap_1.ensureSeedData)();
    res.json({ message: "Seed completed" });
});
router.post("/login", rateLimit_1.loginLimiter, async (req, res) => {
    const parsed = schemas_1.userLoginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: "Invalid credentials" });
    const { username, pin } = parsed.data;
    const user = await prisma_1.prisma.user.findUnique({ where: { username }, include: { role: true } });
    if (!user)
        return res.status(401).json({ message: "Invalid username or PIN" });
    const match = await bcryptjs_1.default.compare(pin, user.pinHash);
    if (!match)
        return res.status(401).json({ message: "Invalid username or PIN" });
    const accessToken = (0, jwt_1.signAccessToken)({ sub: String(user.id), role: user.role.name });
    const refreshToken = (0, jwt_1.signRefreshToken)({ sub: String(user.id), role: user.role.name });
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });
    await prisma_1.prisma.loginLog.create({ data: { userId: user.id, ip: req.ip, userAgent: req.headers["user-agent"] || undefined } });
    await (0, audit_1.recordAudit)({ userId: user.id, entity: "auth", action: "login" });
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
    if (!token)
        return res.status(400).json({ message: "Missing refresh token" });
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        const user = await prisma_1.prisma.user.findUnique({ where: { id: Number(payload.sub) }, include: { role: true } });
        if (!user)
            return res.status(401).json({ message: "Invalid token" });
        const accessToken = (0, jwt_1.signAccessToken)({ sub: String(user.id), role: user.role.name });
        res.json({ accessToken });
    }
    catch (error) {
        logger_1.log.error("Refresh failed", error);
        res.status(401).json({ message: "Invalid token" });
    }
});
router.get("/me", auth_1.requireAuth, async (req, res) => {
    if (!req.user)
        return res.status(401).end();
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id }, include: { role: true } });
    res.json({
        id: user?.id,
        username: user?.username,
        role: user?.role.name,
        permissions: user?.role.permissions,
        lastLoginAt: user?.lastLoginAt,
    });
});
router.post("/change-pin", auth_1.requireAuth, async (req, res) => {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const parsed = schemas_1.changePinSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ issues: parsed.error.issues });
    const { currentPin, newPin } = parsed.data;
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user)
        return res.status(404).json({ message: "User not found" });
    const match = await bcryptjs_1.default.compare(currentPin, user.pinHash);
    if (!match)
        return res.status(400).json({ message: "Current PIN incorrect" });
    const pinHash = await bcryptjs_1.default.hash(newPin, 10);
    await prisma_1.prisma.user.update({ where: { id: user.id }, data: { pinHash } });
    await (0, audit_1.recordAudit)({ userId: user.id, entity: "user", entityId: String(user.id), action: "change-pin" });
    res.json({ message: "PIN updated" });
});
exports.default = router;
