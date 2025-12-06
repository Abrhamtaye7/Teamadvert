"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
router.get("/", async (req, res) => {
    const userId = req.user?.id;
    const notifications = await prisma_1.prisma.notification.findMany({
        where: { OR: [{ userId }, { userId: null }] },
        orderBy: { createdAt: "desc" },
        take: 50,
    });
    res.json(notifications);
});
router.post("/:id/read", async (req, res) => {
    const id = Number(req.params.id);
    const notification = await prisma_1.prisma.notification.update({ where: { id }, data: { read: true } });
    res.json(notification);
});
exports.default = router;
