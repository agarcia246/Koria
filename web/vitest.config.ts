import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Pure unit tests only. Database tests live in `*.db.test.ts` and run with
 * `npm run test:db` (vitest.db.config.ts). CI's check job has no database.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.db.test.ts", "**/node_modules/**", "**/.next/**"],
  },
});
