import { resolve } from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "src/lib/**",
        "src/services/**",
        "src/hooks/**",
        "src/components/layout/AdminSidebar.tsx",
        "src/components/layout/ResidentSidebar.tsx",
        "src/components/layout/Header.tsx",
        "src/components/features/**",
        "src/components/ui/StatusBadge.tsx",
        "src/app/(auth)/**",
        "src/app/r/**",
        "src/app/api/v1/auth/me/**",
        "src/app/api/v1/residents/me/**",
        "src/app/api/v1/super-admin/plans/**",
        "src/app/api/v1/super-admin/discounts/**",
      ],
      exclude: [
        "src/lib/prisma.ts",
        "src/lib/supabase/**",
        "src/lib/whatsapp.ts",
        "src/lib/email-templates/**",
        "src/app/r/loading.tsx",
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
});
