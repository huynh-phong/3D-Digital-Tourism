import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  // building the whole city (~4 km × 4 km) takes several seconds, more when files run in parallel
  test: { environment: "node", include: ["tests/**/*.test.ts"], testTimeout: 60000, hookTimeout: 60000 },
});
