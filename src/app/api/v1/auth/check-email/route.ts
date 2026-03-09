import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const checkEmailSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = checkEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Valid email required" } },
        { status: 422 },
      );
    }

    // Check if any user with this email has a Supabase auth account
    const existing = await prisma.user.findFirst({
      where: { email: parsed.data.email, authUserId: { not: null } },
      select: { id: true },
    });

    return NextResponse.json({ existsInAuth: !!existing });
  } catch (err) {
    console.error("Check email error:", err);
    return internalError("Failed to check email");
  }
}
