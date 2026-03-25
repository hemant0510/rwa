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
    testTimeout: 15000, // UI integration tests with form navigation need extra time under coverage instrumentation
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
        "src/middleware.ts",
        "src/components/layout/AdminSidebar.tsx",
        "src/components/layout/ResidentSidebar.tsx",
        "src/components/layout/Header.tsx",
        "src/components/features/**",
        "src/components/ui/StatusBadge.tsx",
        "src/app/(auth)/**",
        "src/app/r/**",
        "src/app/api/v1/auth/me/**",
        "src/app/api/v1/residents/me/**",
        "src/app/api/v1/residents/**/id-proof/**",
        "src/app/api/v1/residents/**/ownership-proof/**",
        "src/app/api/v1/super-admin/plans/**",
        "src/app/api/v1/super-admin/discounts/**",
        "src/app/api/v1/societies/[id]/admins/**",
        "src/app/api/v1/residents/[id]/send-setup-email/**",
        "src/app/api/v1/residents/route.ts",
        "src/app/api/v1/residents/[id]/approve/**",
        "src/app/api/v1/residents/[id]/reject/**",
        "src/app/api/v1/residents/[id]/send-verification/**",
        "src/app/api/v1/residents/bulk-upload/**",
        "src/app/api/v1/auth/forgot-password/**",
        "src/app/api/v1/auth/login/**",
        "src/app/api/v1/auth/register-society/**",
        "src/app/api/v1/auth/plans/**",
        "src/app/api/v1/societies/[id]/migration/import-stream/**",
        "src/lib/migration-processor.ts",
        "src/app/api/v1/societies/[id]/fees/[feeId]/payments/**",
        "src/app/api/cron/fee-status-activate/**",
        "src/app/api/cron/fee-overdue-check/**",
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
