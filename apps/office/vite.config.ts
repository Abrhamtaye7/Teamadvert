/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/office/",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // `npm run dev:api` serves the API on 4000
      "/api": "http://localhost:4000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
