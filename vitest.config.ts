import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Même alias que l'application web, pour tester ses modules tels qu'ils s'importent.
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}", "apps/*/test/**/*.test.{ts,tsx}"],
  },
});
