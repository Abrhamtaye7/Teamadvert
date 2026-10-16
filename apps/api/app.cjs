// cPanel "Setup Node.js App" startup file. Passenger loads CommonJS most reliably,
// so this tiny loader imports the bundled ESM server.
import("./dist/server.mjs").catch((err) => {
  console.error("Failed to start Team Advert API:", err);
  process.exit(1);
});
