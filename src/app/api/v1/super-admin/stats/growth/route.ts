import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

// GET /api/v1/super-admin/stats/growth
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const now = new Date();
    // Start of 12 months ago
    const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const societies = await prisma.society.findMany({
      select: { onboardingDate: true },
      orderBy: { onboardingDate: "asc" },
    });

    // Build month buckets: last 12 months (label: "Jan 2026")
    const months: { label: string; year: number; month: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleString("en-US", { month: "short", year: "numeric" }),
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }

    // Count societies onboarded up to (and including) each month end — cumulative
    const data = months.map(({ label, year, month }) => {
      const periodEnd = new Date(year, month + 1, 0, 23, 59, 59, 999); // last ms of month
      const count = societies.filter(
        (s) => s.onboardingDate && new Date(s.onboardingDate) <= periodEnd,
      ).length;
      return { month: label, count };
    });

    // Also include total societies registered before the 12-month window
    const totalBefore = societies.filter(
      (s) => s.onboardingDate && new Date(s.onboardingDate) < from,
    ).length;

    return successResponse({ data, totalBefore });
  } catch {
    return internalError("Failed to fetch growth stats");
  }
}
