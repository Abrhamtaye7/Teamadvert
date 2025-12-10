import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: num(process.env.BLACKCARD_PORT, 5001),
  jwtSecret: process.env.BLACKCARD_JWT_SECRET || "blackcard-secret",
  withdrawalCap: num(process.env.BLACKCARD_WITHDRAWAL_CAP, 0.8),
  developerSplit: {
    devA: num(process.env.BLACKCARD_DEV_A ?? "40", 40),
    devB: num(process.env.BLACKCARD_DEV_B ?? "30", 30),
    devC: num(process.env.BLACKCARD_DEV_C ?? "30", 30),
  },
};
