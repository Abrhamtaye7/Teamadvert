"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.signRefreshToken = exports.signAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const signAccessToken = (payload) => jsonwebtoken_1.default.sign(payload, env_1.config.jwtSecret, { expiresIn: `${env_1.config.tokenTtlMinutes}m` });
exports.signAccessToken = signAccessToken;
const signRefreshToken = (payload) => jsonwebtoken_1.default.sign(payload, env_1.config.jwtSecret, { expiresIn: `${env_1.config.refreshTtlDays}d` });
exports.signRefreshToken = signRefreshToken;
const verifyToken = (token) => jsonwebtoken_1.default.verify(token, env_1.config.jwtSecret);
exports.verifyToken = verifyToken;
