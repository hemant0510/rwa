import { NextRequest } from "next/server";

import { Prisma } from "@prisma/client";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

function parseExpiryRange(range: string | null) {
  const now = new Date();
  if (!range || range === "all") return undefined;
  if (range === "expired") return { currentPeriodEnd: { lt: now } };

  const days = Number(range);
  if (Number.isNaN(days)) return undefined;
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  return { currentPeriodEnd: { gte: now, lte: end } };
}

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

// GET /api/v1/super-admin/billing/subscriptions
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const expiryRange = parseExpiryRange(searchParams.get("expiryRange"));
    const sortBy = searchParams.get("sortBy") ?? "expiry";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = {};
    if (status && status !== "all") where.status = status;
    if (expiryRange) Object.assign(where, expiryRange);

    const subscriptions = await prisma.societySubscription.findMany({
      where: {
        ...where,
        society: search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { societyCode: { contains: search, mode: "insensitive" } },
              ],
            }
          : undefined,
      },
      include: {
        society: {
          select: { id: true, name: true, societyCode: true, subscriptionExpiresAt: true },
        },
        plan: { select: { id: true, name: true } },
        billingOption: { select: { billingCycle: true, price: true } },
      },
      orderBy:
        sortBy === "name"
          ? { society: { name: sortOrder } }
          : sortBy === "plan"
            ? { plan: { name: sortOrder } }
            : { currentPeriodEnd: sortOrder },
      take: 500,
    });

    const ids = subscriptions.map((s) => s.societyId);
    let lastPayments: Array<{ societyId: string; paymentDate: Date; amount: Prisma.Decimal }> = [];
    let invoices: Array<{ societyId: string; finalAmount: Prisma.Decimal }> = [];
    try {
      [lastPayments, invoices] = await Promise.all([
        prisma.subscriptionPayment.findMany({
          where: { societyId: { in: ids }, isReversal: false },
          orderBy: { paymentDate: "desc" },
          select: { societyId: true, paymentDate: true, amount: true },
        }),
        prisma.subscriptionInvoice.findMany({
          where: {
            societyId: { in: ids },
            status: { in: ["UNPAID", "OVERDUE", "PARTIALLY_PAID"] },
          },
          orderBy: { createdAt: "desc" },
          select: { societyId: true, finalAmount: true },
        }),
      ]);
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
    }

    const lastPaymentBySociety = new Map<string, { paymentDate: Date; amount: number }>();
    for (const payment of lastPayments) {
      if (!lastPaymentBySociety.has(payment.societyId)) {
        lastPaymentBySociety.set(payment.societyId, {
          paymentDate: payment.paymentDate,
          amount: Number(payment.amount),
        });
      }
    }

    const amountDueBySociety = new Map<string, number>();
    for (const invoice of invoices) {
      if (!amountDueBySociety.has(invoice.societyId)) {
        amountDueBySociety.set(invoice.societyId, Number(invoice.finalAmount));
      }
    }

    return successResponse(
      subscriptions.map((s) => ({
        id: s.id,
        societyId: s.societyId,
        societyName: s.society.name,
        societyCode: s.society.societyCode,
        planName: s.plan?.name ?? "Trial",
        billingCycle: s.billingOption?.billingCycle ?? null,
        status: s.status,
        periodEndDate: s.currentPeriodEnd,
        amountDue: amountDueBySociety.get(s.societyId) ?? 0,
        lastPaymentDate: lastPaymentBySociety.get(s.societyId)?.paymentDate ?? null,
        lastPaymentAmount: lastPaymentBySociety.get(s.societyId)?.amount ?? null,
      })),
    );
  } catch {
    return internalError("Failed to fetch subscriptions");
  }
}
