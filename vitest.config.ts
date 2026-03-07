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
      include: [
        "src/lib/**",
        "src/services/**",
        "src/hooks/**",
        "src/components/layout/AdminSidebar.tsx",
        "src/components/layout/Header.tsx",
        "src/components/features/**",
        "src/components/ui/StatusBadge.tsx",
        "src/app/(auth)/**",
      ],
      exclude: [
        "src/lib/prisma.ts",
        "src/lib/supabase/**",
        "src/lib/whatsapp.ts",
        "src/lib/email-templates/**",
      ],
    },
  },
});
