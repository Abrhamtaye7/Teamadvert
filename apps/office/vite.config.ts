import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  base: "/office/",
  plugins: [react()],
  server: {
    proxy: {
      // `npm run dev:api` serves the Worker on 8787
      "/api": "http://localhost:8787",
    },
  },
});
