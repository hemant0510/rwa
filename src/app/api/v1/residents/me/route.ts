import { NextResponse } from "next/server";

import { internalError } from "@/lib/api-helpers";
import { getSessionYear } from "@/lib/fee-calculator";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: { authUserId: authUser.id, role: "RESIDENT" },
      include: {
        society: {
          select: { name: true, societyCode: true },
        },
        userUnits: {
          include: {
            unit: {
              select: { displayLabel: true },
            },
          },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get current fee record
    const sessionYear = getSessionYear(new Date());
    const currentFee = await prisma.membershipFee.findFirst({
      where: { userId: user.id, sessionYear },
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      rwaid: user.rwaid,
      status: user.status,
      ownershipType: user.ownershipType,
      societyName: user.society?.name ?? null,
      unit: user.userUnits[0]?.unit?.displayLabel ?? null,
      currentFee: currentFee
        ? {
            sessionYear: currentFee.sessionYear,
            amountDue: Number(currentFee.amountDue),
            amountPaid: Number(currentFee.amountPaid),
            status: currentFee.status,
          }
        : null,
    });
  } catch (err) {
    console.error("Resident me error:", err);
    return internalError("Failed to fetch profile");
  }
}
