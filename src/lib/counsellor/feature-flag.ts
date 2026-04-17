import { cache } from "react";

import { prisma } from "@/lib/prisma";

const FLAG_KEY = "counsellor_role_enabled";

export const isCounsellorRoleEnabled = cache(async (): Promise<boolean> => {
  try {
    const row = await prisma.platformConfig.findUnique({
      where: { key: FLAG_KEY },
      select: { value: true },
    });
    if (!row) return false;
    return row.value === "true";
  } catch (err) {
    console.error("[CounsellorFeatureFlag] Failed to read:", err);
    return false;
  }
});

export const COUNSELLOR_ROLE_FLAG_KEY = FLAG_KEY;
