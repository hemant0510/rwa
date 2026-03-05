import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get("code");

  if (!code || code.length < 4 || code.length > 8) {
    return NextResponse.json({ available: false, error: "Code must be 4-8 characters" });
  }

  const existing = await prisma.society.findUnique({
    where: { societyCode: code.toUpperCase() },
  });

  return NextResponse.json({ available: !existing });
}
