import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        // App Router page/layout files — tested via E2E (Task 9)
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        // UI-only components — tested via E2E; unit tests cover logic only
        "src/components/shells/**",
        "src/components/design-system/**",
        "src/components/composed/**",
        // React providers — integration-tested via E2E
        "src/providers/**",
        // Dashboard client card — E2E scope
        "src/app/**/dashboard/_components/**",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
