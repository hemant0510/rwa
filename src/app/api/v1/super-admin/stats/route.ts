import { NextResponse } from "next/server";

import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const [total, active, trial, suspended, recentSocieties] = await Promise.all([
      prisma.society.count(),
      prisma.society.count({ where: { status: "ACTIVE" } }),
      prisma.society.count({ where: { status: "TRIAL" } }),
      prisma.society.count({ where: { status: "SUSPENDED" } }),
      prisma.society.findMany({
        orderBy: { onboardingDate: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          societyCode: true,
          city: true,
          status: true,
          onboardingDate: true,
        },
      }),
    ]);

    return NextResponse.json({
      total,
      active,
      trial,
      suspended,
      recentSocieties: recentSocieties.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.societyCode,
        city: s.city,
        status: s.status,
        onboardingDate: s.onboardingDate,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch stats" } },
      { status: 500 },
    );
  }
}
