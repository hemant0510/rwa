import { NextRequest, NextResponse } from "next/server";

import { forbiddenError, internalError } from "@/lib/api-helpers";
import { getSessionDates } from "@/lib/fee-calculator";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createFeeSessionSchema } from "@/lib/validations/society";

async function getAdminWithSociety() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await prisma.user.findFirst({
    where: { authUserId: authUser.id, role: "RWA_ADMIN" },
    select: { id: true, adminPermission: true, societyId: true },
  });

  if (!user || user.adminPermission !== "FULL_ACCESS" || !user.societyId) return null;

  return { userId: user.id, societyId: user.societyId };
}

export async function GET() {
  try {
    const admin = await getAdminWithSociety();
    if (!admin) return forbiddenError("Only admins with full access can view fee sessions");

    const sessions = await prisma.feeSession.findMany({
      where: { societyId: admin.societyId },
      orderBy: { sessionYear: "desc" },
    });

    return NextResponse.json(
      sessions.map((s) => ({
        id: s.id,
        sessionYear: s.sessionYear,
        annualFee: Number(s.annualFee),
        joiningFee: Number(s.joiningFee),
        sessionStart: s.sessionStart,
        sessionEnd: s.sessionEnd,
        gracePeriodEnd: s.gracePeriodEnd,
        status: s.status,
      })),
    );
  } catch (err) {
    console.error("Fee sessions fetch error:", err);
    return internalError("Failed to fetch fee sessions");
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminWithSociety();
    if (!admin) return forbiddenError("Only admins with full access can create fee sessions");

    const body = await request.json();
    const parsed = createFeeSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Valid year is required." } },
        { status: 422 },
      );
    }

    const { year } = parsed.data;

    // Get society config
    const society = await prisma.society.findUnique({
      where: { id: admin.societyId },
      select: {
        joiningFee: true,
        annualFee: true,
        gracePeriodDays: true,
        feeSessionStartMonth: true,
      },
    });

    if (!society) return forbiddenError("Society not found");

    // Calculate session year string (e.g., "2025-26")
    const sessionYear = `${year}-${String(year + 1).slice(2)}`;

    // Check for duplicate
    const existing = await prisma.feeSession.findUnique({
      where: { societyId_sessionYear: { societyId: admin.societyId, sessionYear } },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: {
            code: "DUPLICATE_SESSION",
            message: `A fee session for ${sessionYear} already exists.`,
          },
        },
        { status: 409 },
      );
    }

    // Calculate dates
    const { start, end } = getSessionDates(sessionYear, society.feeSessionStartMonth);
    const gracePeriodEnd = new Date(start);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + society.gracePeriodDays);

    // Determine status
    const now = new Date();
    let status = "UPCOMING";
    if (now >= start && now <= end) status = "ACTIVE";
    else if (now > end) status = "COMPLETED";

    const session = await prisma.feeSession.create({
      data: {
        societyId: admin.societyId,
        sessionYear,
        annualFee: Number(society.annualFee),
        joiningFee: Number(society.joiningFee),
        sessionStart: start,
        sessionEnd: end,
        gracePeriodEnd,
        status,
      },
    });

    return NextResponse.json(
      {
        id: session.id,
        sessionYear: session.sessionYear,
        annualFee: Number(session.annualFee),
        joiningFee: Number(session.joiningFee),
        sessionStart: session.sessionStart,
        sessionEnd: session.sessionEnd,
        gracePeriodEnd: session.gracePeriodEnd,
        status: session.status,
        message: `Fee session ${sessionYear} created successfully.`,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Fee session create error:", err);
    return internalError("Failed to create fee session");
  }
}
