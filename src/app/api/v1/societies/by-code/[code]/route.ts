import { NextRequest, NextResponse } from "next/server";

import { notFoundError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const society = await prisma.society.findUnique({
    where: { societyCode: code.toUpperCase() },
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      state: true,
      status: true,
    },
  });

  if (!society || society.status === "SUSPENDED" || society.status === "OFFBOARDED") {
    return notFoundError("Society not found or unavailable");
  }

  return NextResponse.json(society);
}
