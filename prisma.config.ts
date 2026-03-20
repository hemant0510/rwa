import "dotenv/config";
import path from "node:path";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join(__dirname, "supabase", "dbinuse.prisma"),
  datasource: {
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_URL,
  },
  migrations: {
    seed: "npx tsx supabase/seed.ts",
  },
});
