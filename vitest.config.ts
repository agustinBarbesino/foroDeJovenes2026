import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    // Cada archivo corre en su propio proceso para no compartir el PrismaClient.
    pool: "forks",
  },
});
