import { type NextRequest, NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export type AlertPriority = "HIGH" | "MEDIUM" | "LOW";
export type AlertType =
  | "TRIAL_EXPIRING"
  | "SUBSCRIPTION_EXPIRED"
  | "PAYMENT_OVERDUE"
  | "SOCIETY_REGISTERED";

export interface Alert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  description: string;
  societyId: string;
  societyName: string;
  createdAt: string;
}

const PRIORITY_ORDER: Record<AlertPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [trialsExpiring, expiredSubs, overdueInvoices, recentSocieties] = await Promise.all([
      // Trials expiring within 3 days
      prisma.societySubscription.findMany({
        where: {
          status: "TRIAL",
          currentPeriodEnd: { lte: threeDaysFromNow },
        },
        include: { society: { select: { id: true, name: true } } },
      }),

      // Subscriptions expired in last 30 days
      prisma.societySubscription.findMany({
        where: {
          status: "EXPIRED",
          currentPeriodEnd: { gte: thirtyDaysAgo },
        },
        include: { society: { select: { id: true, name: true } } },
      }),

      // Overdue invoices
      prisma.subscriptionInvoice.findMany({
        where: { status: "OVERDUE" },
        include: { society: { select: { id: true, name: true } } },
      }),

      // Societies registered in last 7 days
      prisma.society.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { id: true, name: true, createdAt: true },
      }),
    ]);

    const alerts: Alert[] = [];

    for (const sub of trialsExpiring) {
      if (!sub.society) continue;
      alerts.push({
        id: `trial-expiring-${sub.id}`,
        type: "TRIAL_EXPIRING",
        priority: "HIGH",
        title: "Trial Expiring Soon",
        description: `${sub.society.name} trial ends ${sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-IN") : "soon"}`,
        societyId: sub.society.id,
        societyName: sub.society.name,
        createdAt: sub.currentPeriodEnd?.toISOString() ?? sub.createdAt.toISOString(),
      });
    }

    for (const sub of expiredSubs) {
      if (!sub.society) continue;
      alerts.push({
        id: `sub-expired-${sub.id}`,
        type: "SUBSCRIPTION_EXPIRED",
        priority: "HIGH",
        title: "Subscription Expired",
        description: `${sub.society.name} subscription expired on ${sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-IN") : "unknown date"}`,
        societyId: sub.society.id,
        societyName: sub.society.name,
        createdAt: sub.currentPeriodEnd?.toISOString() ?? sub.createdAt.toISOString(),
      });
    }

    for (const invoice of overdueInvoices) {
      if (!invoice.society) continue;
      alerts.push({
        id: `overdue-${invoice.id}`,
        type: "PAYMENT_OVERDUE",
        priority: "MEDIUM",
        title: "Payment Overdue",
        description: `${invoice.society.name} — Invoice #${invoice.invoiceNo} is overdue (due ${new Date(invoice.dueDate).toLocaleDateString("en-IN")})`,
        societyId: invoice.society.id,
        societyName: invoice.society.name,
        createdAt: invoice.dueDate.toISOString(),
      });
    }

    for (const society of recentSocieties) {
      alerts.push({
        id: `registered-${society.id}`,
        type: "SOCIETY_REGISTERED",
        priority: "LOW",
        title: "New Society Registered",
        description: `${society.name} joined the platform`,
        societyId: society.id,
        societyName: society.name,
        createdAt: society.createdAt.toISOString(),
      });
    }

    // Sort by priority, then by createdAt descending
    alerts.sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pd !== 0) return pd;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return successResponse(alerts);
  } catch (err) {
    console.error("[SA Notifications]", err);
    return internalError();
  }
}
