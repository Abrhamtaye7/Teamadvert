"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../../.env") });
const num = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
exports.config = {
    port: num(process.env.PORT, 4000),
    jwtSecret: process.env.JWT_SECRET || "change-me",
    tokenTtlMinutes: num(process.env.TOKEN_TTL_MINUTES, 60),
    refreshTtlDays: num(process.env.REFRESH_TTL_DAYS, 7),
    backupDir: process.env.BACKUP_DIR || path_1.default.resolve(__dirname, "../../../backups"),
    cbeBaseUrl: "https://apps.cbe.com.et:100/?id=", // PRD base
};
