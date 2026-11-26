import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Las rutas de Next usan el alias "@/..." y los tests las importan directo.
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
  test: {
    setupFiles: ["./tests/setup.ts"],
    // Cada archivo corre en su propio proceso para no compartir el PrismaClient.
    pool: "forks",
  },
});
