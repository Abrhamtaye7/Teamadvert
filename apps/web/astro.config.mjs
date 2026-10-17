import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://teamadvertplc.com",
  trailingSlash: "ignore",
  build: { format: "directory" },
  // /verify/ is only reached by scanning a proforma's QR code: keep it out of search engines
  integrations: [sitemap({ filter: (page) => !page.includes("/404") && !page.includes("/verify") })],
  vite: {
    plugins: [tailwindcss()],
    // `npm run dev:web` talks to the local API for the quote form
    server: { proxy: { "/api": "http://localhost:4000" } },
  },
});
