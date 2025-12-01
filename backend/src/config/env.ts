import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: num(process.env.PORT, 4000),
  jwtSecret: process.env.JWT_SECRET || "change-me",
  tokenTtlMinutes: num(process.env.TOKEN_TTL_MINUTES, 60),
  refreshTtlDays: num(process.env.REFRESH_TTL_DAYS, 7),
  backupDir: process.env.BACKUP_DIR || path.resolve(__dirname, "../../../backups"),
  cbeBaseUrl: "https://apps.cbe.com.et:100/?id=", // PRD base
};
