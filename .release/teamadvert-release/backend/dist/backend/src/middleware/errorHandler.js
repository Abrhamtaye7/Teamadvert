"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
function errorHandler(err, _req, res, _next) {
    logger_1.log.error(err);
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({ message: "Validation failed", issues: err.issues });
    }
    return res.status(500).json({ message: "Internal server error" });
}
