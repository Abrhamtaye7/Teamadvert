import { defineConfig } from "drizzle-kit";
import { loadRootEnv } from "./src/env";

loadRootEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  casing: "snake_case",
  migrations: { schema: "public" },
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
