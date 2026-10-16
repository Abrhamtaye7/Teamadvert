import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Every test file resets the shared test database, so files must not run in parallel.
    fileParallelism: false,
  },
});
