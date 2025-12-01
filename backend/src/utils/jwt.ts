import jwt from "jsonwebtoken";
import { config } from "../config/env";

export interface JwtPayload {
  sub: string;
  role: string;
}

export const signAccessToken = (payload: JwtPayload) =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: `${config.tokenTtlMinutes}m` });

export const signRefreshToken = (payload: JwtPayload) =>
  jwt.sign(payload, config.jwtSecret, { expiresIn: `${config.refreshTtlDays}d` });

export const verifyToken = (token: string) => jwt.verify(token, config.jwtSecret) as JwtPayload & jwt.JwtPayload;
