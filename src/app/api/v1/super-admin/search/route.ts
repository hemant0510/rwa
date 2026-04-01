import { type NextRequest, NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";

    if (!q) {
      return successResponse({
        societies: [],
        residents: [],
        payments: [],
        events: [],
        petitions: [],
      });
    }

    const containsInsensitive = { contains: q, mode: "insensitive" as const };
    const contains = { contains: q };

    const [societies, residents, payments, events, petitions] = await Promise.all([
      prisma.society.findMany({
        where: {
          OR: [
            { name: containsInsensitive },
            { societyCode: containsInsensitive },
            { city: containsInsensitive },
          ],
        },
        select: {
          id: true,
          name: true,
          societyCode: true,
          status: true,
          city: true,
        },
        take: 5,
        orderBy: { name: "asc" },
      }),

      prisma.user.findMany({
        where: {
          role: "RESIDENT",
          OR: [
            { name: containsInsensitive },
            { email: containsInsensitive },
            { mobile: contains },
            { rwaid: containsInsensitive },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          societyId: true,
          society: { select: { name: true } },
        },
        take: 5,
        orderBy: { name: "asc" },
      }),

      prisma.feePayment.findMany({
        where: {
          OR: [{ referenceNo: containsInsensitive }, { receiptNo: containsInsensitive }],
        },
        select: {
          id: true,
          amount: true,
          receiptNo: true,
          referenceNo: true,
          paymentDate: true,
          societyId: true,
          user: { select: { name: true } },
          society: { select: { name: true } },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),

      prisma.communityEvent.findMany({
        where: {
          title: containsInsensitive,
        },
        select: {
          id: true,
          title: true,
          status: true,
          societyId: true,
          society: { select: { name: true } },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),

      prisma.petition.findMany({
        where: {
          title: containsInsensitive,
        },
        select: {
          id: true,
          title: true,
          status: true,
          societyId: true,
          society: { select: { name: true } },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return successResponse({
      societies,
      residents,
      payments,
      events,
      petitions,
    });
  } catch (err) {
    console.error("[SA Global Search]", err);
    return internalError();
  }
}
